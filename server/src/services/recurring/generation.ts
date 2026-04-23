/**
 * Invoice generation — clones template documents into real SAVED invoices
 * and advances the recurring schedule state.
 *
 * Generation flow:
 *   1. Find ACTIVE recurring records where nextRunDate <= now
 *   2. For each: clone template document (all fields + line items + charges)
 *   3. Assign new document number (SAVED status), set recurringInvoiceId
 *   4. Advance nextRunDate, increment generatedCount — all in one $transaction
 */

import { prisma } from '../../lib/prisma.js'
import { generateNextNumber } from '../document-number.service.js'
import logger from '../../lib/logger.js'
import { calculateNextRunDate } from './dates.js'
import { TEMPLATE_SELECT, cloneLineItems, cloneAdditionalCharges } from './clone.js'
import type { TemplateData } from './clone.js'

type DueSchedule = {
  id: string
  businessId: string
  templateDocumentId: string
  frequency: string
  endDate: Date | null
  nextRunDate: Date
  dayOfMonth: number | null
  dayOfWeek: number | null
}

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
    take: 500,
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
async function generateOneInvoice(schedule: DueSchedule, now: Date) {
  const template = await prisma.document.findFirst({
    where: { id: schedule.templateDocumentId, businessId: schedule.businessId },
    select: TEMPLATE_SELECT,
  })

  if (!template) {
    throw new Error(`Template document ${schedule.templateDocumentId} not found`)
  }

  const documentDate = new Date(now)
  documentDate.setUTCHours(0, 0, 0, 0)

  return prisma.$transaction(async (tx) => {
    const numberData = await generateNextNumber(tx, schedule.businessId, template.type, documentDate)

    const newDoc = await tx.document.create({
      data: buildDocumentData(schedule, template, documentDate, numberData),
      select: { id: true },
    })

    await cloneLineItems(tx as never, newDoc.id, template.lineItems)
    await cloneAdditionalCharges(tx as never, newDoc.id, template.additionalCharges)

    const nextRunDate = calculateNextRunDate(
      schedule.nextRunDate,
      schedule.frequency,
      schedule.dayOfMonth,
      schedule.dayOfWeek,
    )

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

function buildDocumentData(
  schedule: DueSchedule,
  template: TemplateData,
  documentDate: Date,
  numberData: { documentNumber: string; sequenceNumber: number; financialYear: string },
) {
  return {
    businessId: schedule.businessId,
    type: template.type,
    status: 'SAVED' as const,
    documentNumber: numberData.documentNumber,
    sequenceNumber: numberData.sequenceNumber,
    financialYear: numberData.financialYear,
    partyId: template.partyId,
    shippingAddressId: template.shippingAddressId ?? null,
    documentDate,
    dueDate: null,
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
    balanceDue: template.grandTotal,
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
    recurringInvoiceId: schedule.id,
    createdBy: 'system',
  }
}
