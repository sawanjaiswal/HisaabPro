/**
 * Recurring Invoice Service
 * Manages recurring invoice schedules and generates due invoices from templates.
 *
 * Generation flow:
 *   1. Find ACTIVE recurring records where nextRunDate <= now
 *   2. For each: clone template document (all fields + line items + charges)
 *   3. Assign new document number (SAVED status), set recurringInvoiceId
 *   4. Advance nextRunDate, increment generatedCount — all in one $transaction
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError, validationError } from '../lib/errors.js'
import { generateNextNumber } from './document-number.service.js'
import logger from '../lib/logger.js'
import type {
  CreateRecurringInput,
  UpdateRecurringInput,
  ListRecurringQuery,
} from '../schemas/recurring.schemas.js'

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Calculate the next run date after `current` for a given frequency.
 * dayOfMonth (1-28) is used for MONTHLY/QUARTERLY/YEARLY.
 * dayOfWeek (0-6, 0 = Sunday) is used for WEEKLY.
 */
export function calculateNextRunDate(
  current: Date,
  frequency: string,
  dayOfMonth?: number | null,
  dayOfWeek?: number | null,
): Date {
  const next = new Date(current)

  switch (frequency) {
    case 'WEEKLY': {
      const target = dayOfWeek ?? current.getDay()
      // Advance by 7 days from current, then snap to target weekday if different
      next.setDate(next.getDate() + 7)
      const diff = (target - next.getDay() + 7) % 7
      next.setDate(next.getDate() + diff)
      break
    }
    case 'MONTHLY': {
      next.setMonth(next.getMonth() + 1)
      if (dayOfMonth) {
        // Clamp to last day of month (e.g. Feb has no 30th)
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
        next.setDate(Math.min(dayOfMonth, lastDay))
      }
      break
    }
    case 'QUARTERLY': {
      next.setMonth(next.getMonth() + 3)
      if (dayOfMonth) {
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
        next.setDate(Math.min(dayOfMonth, lastDay))
      }
      break
    }
    case 'YEARLY': {
      next.setFullYear(next.getFullYear() + 1)
      if (dayOfMonth) {
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
        next.setDate(Math.min(dayOfMonth, lastDay))
      }
      break
    }
  }

  // Normalize to start-of-day UTC
  next.setUTCHours(0, 0, 0, 0)
  return next
}

/** Compute first nextRunDate from startDate for a new schedule */
function initialNextRunDate(
  startDate: Date,
  frequency: string,
  dayOfMonth?: number | null,
  dayOfWeek?: number | null,
): Date {
  const d = new Date(startDate)
  d.setUTCHours(0, 0, 0, 0)

  // For MONTHLY+/YEARLY: snap to requested dayOfMonth if provided
  if (dayOfMonth && ['MONTHLY', 'QUARTERLY', 'YEARLY'].includes(frequency)) {
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(dayOfMonth, lastDay))
  }

  // For WEEKLY: snap to requested dayOfWeek if provided
  if (dayOfWeek != null && frequency === 'WEEKLY') {
    const diff = (dayOfWeek - d.getDay() + 7) % 7
    d.setDate(d.getDate() + diff)
    // If that snapped to today or the past, advance one week
    if (d <= new Date()) {
      d.setDate(d.getDate() + 7)
    }
  }

  return d
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createRecurring(
  businessId: string,
  _userId: string,
  data: CreateRecurringInput,
) {
  // Validate template exists and belongs to this business (must be SAVED/SHARED)
  const template = await prisma.document.findFirst({
    where: {
      id: data.templateDocumentId,
      businessId,
      status: { in: ['SAVED', 'SHARED'] },
    },
    select: { id: true, partyId: true, type: true },
  })
  if (!template) {
    throw validationError('Template document not found or not in a saved state')
  }

  const startDate = new Date(data.startDate)
  const endDate = data.endDate ? new Date(data.endDate) : undefined
  if (endDate && endDate <= startDate) {
    throw validationError('endDate must be after startDate')
  }

  const nextRunDate = initialNextRunDate(startDate, data.frequency, data.dayOfMonth, data.dayOfWeek)

  const recurring = await prisma.recurringInvoice.create({
    data: {
      businessId,
      templateDocumentId: data.templateDocumentId,
      partyId: template.partyId,
      frequency: data.frequency,
      startDate,
      endDate: endDate ?? null,
      nextRunDate,
      dayOfMonth: data.dayOfMonth ?? null,
      dayOfWeek: data.dayOfWeek ?? null,
      autoSend: data.autoSend ?? false,
      status: 'ACTIVE',
    },
  })

  return recurring
}

export async function getRecurring(businessId: string, recurringId: string) {
  const recurring = await prisma.recurringInvoice.findFirst({
    where: { id: recurringId, businessId },
    include: {
      _count: { select: { documents: true } },
    },
  })
  if (!recurring) throw notFoundError('Recurring invoice')
  return recurring
}

export async function listRecurring(businessId: string, query: ListRecurringQuery) {
  const { status, page, limit } = query
  const skip = (page - 1) * limit

  const where = {
    businessId,
    ...(status && { status }),
  }

  const [items, total] = await Promise.all([
    prisma.recurringInvoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { documents: true } },
      },
    }),
    prisma.recurringInvoice.count({ where }),
  ])

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function updateRecurring(
  businessId: string,
  recurringId: string,
  data: UpdateRecurringInput,
) {
  const existing = await prisma.recurringInvoice.findFirst({
    where: { id: recurringId, businessId },
    select: {
      id: true,
      status: true,
      frequency: true,
      nextRunDate: true,
      dayOfMonth: true,
      dayOfWeek: true,
    },
  })
  if (!existing) throw notFoundError('Recurring invoice')
  if (existing.status === 'COMPLETED') {
    throw validationError('Cannot update a completed recurring invoice')
  }

  // Recalculate nextRunDate if frequency or day anchor changes
  const frequencyChanged = data.frequency && data.frequency !== existing.frequency
  const dayChanged = data.dayOfMonth !== undefined || data.dayOfWeek !== undefined
  const newFrequency = data.frequency ?? existing.frequency
  const newDayOfMonth = data.dayOfMonth !== undefined ? data.dayOfMonth : existing.dayOfMonth
  const newDayOfWeek = data.dayOfWeek !== undefined ? data.dayOfWeek : existing.dayOfWeek

  let nextRunDate = existing.nextRunDate
  if (frequencyChanged || dayChanged) {
    nextRunDate = calculateNextRunDate(
      new Date(),
      newFrequency,
      newDayOfMonth,
      newDayOfWeek,
    )
  }

  return prisma.recurringInvoice.update({
    where: { id: recurringId },
    data: {
      ...(data.frequency && { frequency: data.frequency }),
      ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
      ...(data.dayOfMonth !== undefined && { dayOfMonth: data.dayOfMonth }),
      ...(data.dayOfWeek !== undefined && { dayOfWeek: data.dayOfWeek }),
      ...(data.autoSend !== undefined && { autoSend: data.autoSend }),
      ...(data.status && { status: data.status }),
      nextRunDate,
    },
  })
}

export async function deleteRecurring(businessId: string, recurringId: string) {
  const existing = await prisma.recurringInvoice.findFirst({
    where: { id: recurringId, businessId },
    select: { id: true, generatedCount: true },
  })
  if (!existing) throw notFoundError('Recurring invoice')

  if (existing.generatedCount === 0) {
    // No documents generated yet — safe hard delete
    await prisma.recurringInvoice.delete({ where: { id: recurringId } })
    return { deleted: true, hard: true }
  }

  // Documents exist — mark as COMPLETED (documents keep their FK via SetNull cascade)
  await prisma.recurringInvoice.update({
    where: { id: recurringId },
    data: { status: 'COMPLETED' },
  })
  return { deleted: false, completed: true }
}

// ─── Generation ───────────────────────────────────────────────────────────────

/**
 * Generate all due invoices for ACTIVE recurring schedules.
 * When businessId is provided, scoped to that business only.
 * When omitted, processes ALL businesses (for cron use).
 */
export async function generateDueInvoices(businessId?: string) {
  const now = new Date()

  const dueSchedules = await prisma.recurringInvoice.findMany({
    where: {
      status: 'ACTIVE',
      nextRunDate: { lte: now },
      ...(businessId && { businessId }),
    },
    select: {
      id: true,
      businessId: true,
      templateDocumentId: true,
      frequency: true,
      endDate: true,
      nextRunDate: true,
      dayOfMonth: true,
      dayOfWeek: true,
    },
  })

  const results: Array<{ recurringId: string; documentId: string; success: boolean; error?: string }> = []

  for (const schedule of dueSchedules) {
    try {
      const generatedDocId = await generateOneInvoice(schedule, now)
      results.push({ recurringId: schedule.id, documentId: generatedDocId, success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.error('Failed to generate recurring invoice', {
        recurringId: schedule.id,
        businessId: schedule.businessId,
        error: message,
      })
      results.push({ recurringId: schedule.id, documentId: '', success: false, error: message })
    }
  }

  return { processed: dueSchedules.length, results }
}

/** Clone one template document into a real SAVED invoice. Advances nextRunDate. */
async function generateOneInvoice(
  schedule: {
    id: string
    businessId: string
    templateDocumentId: string
    frequency: string
    endDate: Date | null
    nextRunDate: Date
    dayOfMonth: number | null
    dayOfWeek: number | null
  },
  now: Date,
) {
  // Fetch template with all child relations needed for cloning
  const template = await prisma.document.findFirst({
    where: { id: schedule.templateDocumentId, businessId: schedule.businessId },
    select: {
      type: true,
      partyId: true,
      shippingAddressId: true,
      paymentTerms: true,
      notes: true,
      termsAndConditions: true,
      includeSignature: true,
      vehicleNumber: true,
      driverName: true,
      transportNotes: true,
      placeOfSupply: true,
      supplyType: true,
      isReverseCharge: true,
      isComposite: true,
      tdsRate: true,
      tdsAmount: true,
      tcsRate: true,
      tcsAmount: true,
      subtotal: true,
      totalDiscount: true,
      totalAdditionalCharges: true,
      roundOff: true,
      grandTotal: true,
      totalCost: true,
      totalProfit: true,
      profitPercent: true,
      totalTaxableValue: true,
      totalCgst: true,
      totalSgst: true,
      totalIgst: true,
      totalCess: true,
      lineItems: {
        select: {
          productId: true,
          sortOrder: true,
          quantity: true,
          rate: true,
          discountType: true,
          discountValue: true,
          discountAmount: true,
          lineTotal: true,
          purchasePrice: true,
          profit: true,
          profitPercent: true,
          stockBefore: true,
          stockAfter: true,
          taxCategoryId: true,
          hsnCode: true,
          sacCode: true,
          taxableValue: true,
          cgstRate: true,
          cgstAmount: true,
          sgstRate: true,
          sgstAmount: true,
          igstRate: true,
          igstAmount: true,
          cessRate: true,
          cessAmount: true,
        },
        orderBy: { sortOrder: 'asc' as const },
      },
      additionalCharges: {
        select: {
          name: true,
          type: true,
          value: true,
          amount: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  })

  if (!template) {
    throw new Error(`Template document ${schedule.templateDocumentId} not found`)
  }

  const documentDate = new Date(now)
  documentDate.setUTCHours(0, 0, 0, 0)

  return prisma.$transaction(async (tx) => {
    // Generate a new document number (treat as SAVED immediately)
    const numberData = await generateNextNumber(tx, schedule.businessId, template.type, documentDate)

    // Create cloned document
    const newDoc = await tx.document.create({
      data: {
        businessId: schedule.businessId,
        type: template.type,
        status: 'SAVED',
        documentNumber: numberData.documentNumber,
        sequenceNumber: numberData.sequenceNumber,
        financialYear: numberData.financialYear,
        partyId: template.partyId,
        shippingAddressId: template.shippingAddressId ?? null,
        documentDate,
        dueDate: null, // recalculated — no stale due date from template
        paymentTerms: template.paymentTerms ?? null,
        notes: template.notes ?? null,
        termsAndConditions: template.termsAndConditions ?? null,
        includeSignature: template.includeSignature,
        vehicleNumber: template.vehicleNumber ?? null,
        driverName: template.driverName ?? null,
        transportNotes: template.transportNotes ?? null,
        subtotal: template.subtotal,
        totalDiscount: template.totalDiscount,
        totalAdditionalCharges: template.totalAdditionalCharges,
        roundOff: template.roundOff,
        grandTotal: template.grandTotal,
        totalCost: template.totalCost,
        totalProfit: template.totalProfit,
        profitPercent: template.profitPercent,
        balanceDue: template.grandTotal, // full balance due on new invoice
        paidAmount: 0,
        placeOfSupply: template.placeOfSupply ?? null,
        supplyType: template.supplyType,
        isReverseCharge: template.isReverseCharge,
        isComposite: template.isComposite,
        totalTaxableValue: template.totalTaxableValue,
        totalCgst: template.totalCgst,
        totalSgst: template.totalSgst,
        totalIgst: template.totalIgst,
        totalCess: template.totalCess,
        tdsRate: template.tdsRate,
        tdsAmount: template.tdsAmount,
        tcsRate: template.tcsRate,
        tcsAmount: template.tcsAmount,
        // Link to recurring schedule
        recurringInvoiceId: schedule.id,
        createdBy: 'system', // scheduler-generated
      },
      select: { id: true },
    })

    // Clone line items
    if (template.lineItems.length > 0) {
      await tx.documentLineItem.createMany({
        data: template.lineItems.map((li) => ({
          documentId: newDoc.id,
          productId: li.productId,
          sortOrder: li.sortOrder,
          quantity: li.quantity,
          rate: li.rate,
          discountType: li.discountType,
          discountValue: li.discountValue,
          discountAmount: li.discountAmount,
          lineTotal: li.lineTotal,
          purchasePrice: li.purchasePrice,
          profit: li.profit,
          profitPercent: li.profitPercent,
          stockBefore: li.stockBefore,
          stockAfter: li.stockAfter,
          taxCategoryId: li.taxCategoryId ?? null,
          hsnCode: li.hsnCode ?? null,
          sacCode: li.sacCode ?? null,
          taxableValue: li.taxableValue,
          cgstRate: li.cgstRate,
          cgstAmount: li.cgstAmount,
          sgstRate: li.sgstRate,
          sgstAmount: li.sgstAmount,
          igstRate: li.igstRate,
          igstAmount: li.igstAmount,
          cessRate: li.cessRate,
          cessAmount: li.cessAmount,
        })),
      })
    }

    // Clone additional charges
    if (template.additionalCharges.length > 0) {
      await tx.documentAdditionalCharge.createMany({
        data: template.additionalCharges.map((c) => ({
          documentId: newDoc.id,
          name: c.name,
          type: c.type,
          value: c.value,
          amount: c.amount,
          sortOrder: c.sortOrder,
        })),
      })
    }

    // Advance the schedule: nextRunDate, generatedCount, lastGeneratedAt
    const nextRunDate = calculateNextRunDate(
      schedule.nextRunDate,
      schedule.frequency,
      schedule.dayOfMonth,
      schedule.dayOfWeek,
    )

    // Mark COMPLETED if endDate reached
    const isExpired = schedule.endDate && nextRunDate > schedule.endDate
    await tx.recurringInvoice.update({
      where: { id: schedule.id },
      data: {
        nextRunDate,
        generatedCount: { increment: 1 },
        lastGeneratedAt: now,
        ...(isExpired && { status: 'COMPLETED' }),
      },
    })

    return newDoc.id
  })
}
