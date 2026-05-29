/** Expense Service — categories and expense records (seed is idempotent). */
import { prisma } from '../lib/prisma.js'
import { notFoundError } from '../lib/errors.js'
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  ListExpensesQuery,
} from '../schemas/expense.schemas.js'
import { notificationManager } from './notifications/notification-manager.js'
import { formatPaise } from './notifications/notification-template.service.js'
import { postExpenseToGL, reverseExpenseGL } from './expense/expense-gl.js'

export {
  seedDefaultCategories,
  createExpenseCategory,
  listExpenseCategories,
} from './expense/expense-category.service.js'

const CATEGORY_SELECT = { select: { id: true, name: true, icon: true, color: true } }

export async function createExpense(
  businessId: string,
  userId: string,
  data: CreateExpenseInput,
) {
  const category = await prisma.expenseCategory.findFirst({
    where: { id: data.categoryId, businessId, isActive: true },
    select: { id: true },
  })
  if (!category) throw notFoundError('Expense category')

  // Created CONFIRMED → post to the GL in the same tx (hard-atomic).
  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        businessId,
        categoryId: data.categoryId,
        amount: data.amount,
        date: data.date,
        paymentMode: data.paymentMode,
        bankAccountId: data.bankAccountId ?? null,
        partyId: data.partyId ?? null,
        referenceNumber: data.referenceNumber ?? null,
        notes: data.notes ?? null,
        gstApplicable: data.gstApplicable ?? false,
        gstRate: data.gstRate ?? 0,
        gstAmount: data.gstAmount ?? 0,
        status: 'CONFIRMED',
        createdBy: userId,
      },
      include: { category: CATEGORY_SELECT },
    })
    await postExpenseToGL(tx, businessId, userId, created)
    return created
  })

  void notificationManager.notify('EXPENSE_RECORDED', { businessId, userId, eventKey: 'EXPENSE_RECORDED', locale: 'en', vars: { amountRs: formatPaise(Number(data.amount)), categoryName: expense.category.name }, entityType: 'expense', entityId: expense.id })
  return expense
}

export async function updateExpense(
  businessId: string,
  expenseId: string,
  userId: string,
  data: UpdateExpenseInput,
) {
  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, businessId, isDeleted: false },
    select: { id: true },
  })
  if (!existing) throw notFoundError('Expense')

  if (data.categoryId) {
    const category = await prisma.expenseCategory.findFirst({
      where: { id: data.categoryId, businessId, isActive: true },
      select: { id: true },
    })
    if (!category) throw notFoundError('Expense category')
  }

  // S1 — GL: reverse the original JE (no-op if unposted) and re-post fresh
  // values when the expense is CONFIRMED. Hard-atomic with the mutation.
  return prisma.$transaction(async (tx) => {
    const updated = await tx.expense.update({
      where: { id: expenseId },
      data: {
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.date !== undefined && { date: data.date }),
        ...(data.paymentMode !== undefined && { paymentMode: data.paymentMode }),
        ...(data.bankAccountId !== undefined && { bankAccountId: data.bankAccountId }),
        ...(data.partyId !== undefined && { partyId: data.partyId }),
        ...(data.referenceNumber !== undefined && { referenceNumber: data.referenceNumber }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.gstApplicable !== undefined && { gstApplicable: data.gstApplicable }),
        ...(data.gstRate !== undefined && { gstRate: data.gstRate }),
        ...(data.gstAmount !== undefined && { gstAmount: data.gstAmount }),
      },
      include: { category: CATEGORY_SELECT },
    })
    await reverseExpenseGL(tx, businessId, expenseId, 'Expense edited')
    if (updated.status === 'CONFIRMED') {
      await postExpenseToGL(tx, businessId, userId, updated)
    }
    return updated
  })
}

export async function getExpense(businessId: string, expenseId: string) {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, businessId, isDeleted: false },
    include: { category: { select: { id: true, name: true, icon: true, color: true } } },
  })
  if (!expense) throw notFoundError('Expense')
  return expense
}

export async function listExpenses(businessId: string, query: ListExpensesQuery) {
  const { categoryId, from, to, paymentMode, status, page, limit } = query
  const skip = (page - 1) * limit

  const where = {
    businessId,
    isDeleted: false,
    status: (status ?? 'CONFIRMED') as 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'SKIPPED' | 'VOIDED',
    ...(categoryId && { categoryId }),
    ...(paymentMode && { paymentMode }),
    ...((from ?? to) && { date: { ...(from && { gte: from }), ...(to && { lte: to }) } }),
  }

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
      include: { category: { select: { id: true, name: true, icon: true, color: true } } },
    }),
    prisma.expense.count({ where }),
  ])

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

export async function deleteExpense(businessId: string, expenseId: string) {
  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, businessId, isDeleted: false },
    select: { id: true },
  })
  if (!existing) throw notFoundError('Expense')

  // S1 — GL: VOID the posted journal entry (no-op if unposted) before the
  // soft-delete, so ledger balances don't strand on a removed expense.
  return prisma.$transaction(async (tx) => {
    await reverseExpenseGL(tx, businessId, expenseId, 'Expense deleted')
    await tx.expense.update({
      where: { id: expenseId },
      data: { isDeleted: true, deletedAt: new Date() },
    })
    return { deleted: true }
  })
}

export async function getExpenseSummary(businessId: string, from?: Date, to?: Date) {
  const where = {
    businessId,
    isDeleted: false,
    status: 'CONFIRMED' as const,
    ...((from ?? to) && { date: { ...(from && { gte: from }), ...(to && { lte: to }) } }),
  }

  const [totalResult, categoryGroups] = await Promise.all([
    prisma.expense.aggregate({
      where,
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.expense.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
    }),
  ])

  const categoryIds = categoryGroups.map((g) => g.categoryId)
  const categories = await prisma.expenseCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, icon: true, color: true },
  })
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  const byCategory = categoryGroups.map((g) => ({
    categoryId: g.categoryId,
    category: categoryMap.get(g.categoryId) ?? null,
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
