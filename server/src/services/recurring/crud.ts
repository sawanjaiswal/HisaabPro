/**
 * CRUD operations for recurring invoice schedules.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import type {
  CreateRecurringInput,
  UpdateRecurringInput,
  ListRecurringQuery,
} from '../../schemas/recurring.schemas.js'
import { calculateNextRunDate, initialNextRunDate } from './dates.js'

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
