/**
 * Other Income Service
 * Manages non-sales income: interest, rent, commission, discount received, miscellaneous.
 * Amounts stored in paise.
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError } from '../lib/errors.js'
import type {
  CreateOtherIncomeInput,
  UpdateOtherIncomeInput,
  ListOtherIncomeQuery,
} from '../schemas/other-income.schemas.js'

export async function createOtherIncome(
  businessId: string,
  userId: string,
  data: CreateOtherIncomeInput,
) {
  return prisma.otherIncome.create({
    data: {
      businessId,
      category: data.category,
      amount: data.amount,
      date: data.date,
      paymentMode: data.paymentMode,
      bankAccountId: data.bankAccountId ?? null,
      partyId: data.partyId ?? null,
      referenceNumber: data.referenceNumber ?? null,
      notes: data.notes ?? null,
      createdBy: userId,
    },
  })
}

export async function updateOtherIncome(
  businessId: string,
  incomeId: string,
  data: UpdateOtherIncomeInput,
) {
  const existing = await prisma.otherIncome.findFirst({
    where: { id: incomeId, businessId, isDeleted: false },
    select: { id: true },
  })
  if (!existing) throw notFoundError('Other income record')

  return prisma.otherIncome.update({
    where: { id: incomeId },
    data: {
      ...(data.category !== undefined && { category: data.category }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.date !== undefined && { date: data.date }),
      ...(data.paymentMode !== undefined && { paymentMode: data.paymentMode }),
      ...(data.bankAccountId !== undefined && { bankAccountId: data.bankAccountId }),
      ...(data.partyId !== undefined && { partyId: data.partyId }),
      ...(data.referenceNumber !== undefined && { referenceNumber: data.referenceNumber }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  })
}

export async function getOtherIncome(businessId: string, incomeId: string) {
  const income = await prisma.otherIncome.findFirst({
    where: { id: incomeId, businessId, isDeleted: false },
  })
  if (!income) throw notFoundError('Other income record')
  return income
}

export async function listOtherIncome(businessId: string, query: ListOtherIncomeQuery) {
  const { category, from, to, page, limit } = query
  const skip = (page - 1) * limit

  const where = {
    businessId,
    isDeleted: false,
    ...(category && { category }),
    ...((from ?? to) && {
      date: {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      },
    }),
  }

  const [items, total] = await Promise.all([
    prisma.otherIncome.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
    }),
    prisma.otherIncome.count({ where }),
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

export async function deleteOtherIncome(businessId: string, incomeId: string) {
  const existing = await prisma.otherIncome.findFirst({
    where: { id: incomeId, businessId, isDeleted: false },
    select: { id: true },
  })
  if (!existing) throw notFoundError('Other income record')

  await prisma.otherIncome.update({
    where: { id: incomeId },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  return { deleted: true }
}

export async function getOtherIncomeSummary(businessId: string, from?: Date, to?: Date) {
  const where = {
    businessId,
    isDeleted: false,
    ...((from ?? to) && {
      date: {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      },
    }),
  }

  // Use DB aggregates — not findMany + reduce
  const [totalResult, categoryGroups] = await Promise.all([
    prisma.otherIncome.aggregate({
      where,
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.otherIncome.groupBy({
      by: ['category'],
      where,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
    }),
  ])

  const byCategory = categoryGroups.map((g) => ({
    category: g.category,
    total: g._sum.amount ?? 0,
    count: g._count.id,
  }))

  return {
    total: totalResult._sum.amount ?? 0,
    count: totalResult._count.id,
    byCategory,
    from: from ?? null,
    to: to ?? null,
  }
}
