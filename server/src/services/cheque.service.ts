/**
 * Cheque Service
 * Manages cheque register: issued and received cheques with clearance/bounce tracking.
 * Amounts in paise.
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError, validationError } from '../lib/errors.js'
import type {
  CreateChequeInput,
  UpdateChequeStatusInput,
  ListChequesQuery,
} from '../schemas/cheque.schemas.js'

export async function createCheque(
  businessId: string,
  userId: string,
  data: CreateChequeInput,
) {
  // Verify bank account belongs to this business
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: data.bankAccountId, businessId, isActive: true },
    select: { id: true },
  })
  if (!bankAccount) throw notFoundError('Bank account')

  return prisma.cheque.create({
    data: {
      businessId,
      type: data.type,
      chequeNumber: data.chequeNumber,
      bankAccountId: data.bankAccountId,
      partyId: data.partyId ?? null,
      amount: data.amount,
      date: data.date,
      status: 'PENDING',
      notes: data.notes ?? null,
      createdBy: userId,
    },
    include: {
      bankAccount: {
        select: { id: true, bankName: true, accountNumber: true },
      },
    },
  })
}

export async function updateChequeStatus(
  businessId: string,
  chequeId: string,
  data: UpdateChequeStatusInput,
) {
  const existing = await prisma.cheque.findFirst({
    where: { id: chequeId, businessId, isDeleted: false },
    select: { id: true, status: true },
  })
  if (!existing) throw notFoundError('Cheque')

  // A cheque that is already cleared/cancelled/returned cannot be updated
  if (['CLEARED', 'CANCELLED', 'RETURNED'].includes(existing.status)) {
    throw validationError(`Cheque is already ${existing.status.toLowerCase()} and cannot be updated`)
  }

  // clearanceDate required for CLEARED
  if (data.status === 'CLEARED' && !data.clearanceDate) {
    throw validationError('clearanceDate is required when marking a cheque as CLEARED')
  }

  const now = new Date()

  return prisma.cheque.update({
    where: { id: chequeId },
    data: {
      status: data.status,
      ...(data.status === 'CLEARED' && { clearanceDate: data.clearanceDate }),
      ...(data.status === 'BOUNCED' && {
        bouncedAt: now,
        bounceCharges: data.bounceCharges ?? 0,
        bounceReason: data.bounceReason ?? null,
      }),
    },
    include: {
      bankAccount: {
        select: { id: true, bankName: true, accountNumber: true },
      },
    },
  })
}

export async function getCheque(businessId: string, chequeId: string) {
  const cheque = await prisma.cheque.findFirst({
    where: { id: chequeId, businessId, isDeleted: false },
    include: {
      bankAccount: {
        select: { id: true, bankName: true, accountNumber: true, accountType: true },
      },
    },
  })
  if (!cheque) throw notFoundError('Cheque')
  return cheque
}

export async function listCheques(businessId: string, query: ListChequesQuery) {
  const { type, status, bankAccountId, from, to, page, limit } = query
  const skip = (page - 1) * limit

  const where = {
    businessId,
    isDeleted: false,
    ...(type && { type }),
    ...(status && { status }),
    ...(bankAccountId && { bankAccountId }),
    ...((from ?? to) && {
      date: {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      },
    }),
  }

  const [items, total] = await Promise.all([
    prisma.cheque.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        bankAccount: {
          select: { id: true, bankName: true, accountNumber: true },
        },
      },
    }),
    prisma.cheque.count({ where }),
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

export async function deleteCheque(businessId: string, chequeId: string) {
  const existing = await prisma.cheque.findFirst({
    where: { id: chequeId, businessId, isDeleted: false },
    select: { id: true, status: true },
  })
  if (!existing) throw notFoundError('Cheque')

  // Only PENDING cheques can be deleted (soft)
  if (existing.status !== 'PENDING') {
    throw validationError(`Cannot delete a cheque with status ${existing.status}. Cancel it first.`)
  }

  await prisma.cheque.update({
    where: { id: chequeId },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  return { deleted: true }
}

export async function getChequeRegisterSummary(businessId: string) {
  // Use DB aggregates to count by status — not findMany + reduce
  const statusCounts = await prisma.cheque.groupBy({
    by: ['status', 'type'],
    where: { businessId, isDeleted: false },
    _count: { id: true },
    _sum: { amount: true },
  })

  // Build summary map
  const summary = {
    issued: { pending: 0, cleared: 0, bounced: 0, cancelled: 0, returned: 0, totalPending: 0, totalCleared: 0 },
    received: { pending: 0, cleared: 0, bounced: 0, cancelled: 0, returned: 0, totalPending: 0, totalCleared: 0 },
  }

  for (const row of statusCounts) {
    const typeKey = row.type.toLowerCase() as 'issued' | 'received'
    const statusKey = row.status.toLowerCase() as keyof typeof summary.issued
    if (statusKey in summary[typeKey]) {
      (summary[typeKey] as Record<string, number>)[statusKey] = row._count.id
    }
    if (row.status === 'PENDING') {
      summary[typeKey].totalPending += row._sum.amount ?? 0
    }
    if (row.status === 'CLEARED') {
      summary[typeKey].totalCleared += row._sum.amount ?? 0
    }
  }

  return summary
}
