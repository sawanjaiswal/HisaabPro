/** Expense Service — categories and expense records (seed is idempotent). */
import { prisma } from '../lib/prisma.js'
import { notFoundError } from '../lib/errors.js'
import type {
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  UpdateExpenseInput,
  ListExpensesQuery,
} from '../schemas/expense.schemas.js'

const DEFAULT_CATEGORIES = [
  { name: 'Rent', icon: '🏠', color: '#EF4444', sortOrder: 1 },
  { name: 'Salary & Wages', icon: '👥', color: '#3B82F6', sortOrder: 2 },
  { name: 'Utilities', icon: '💡', color: '#F59E0B', sortOrder: 3 },
  { name: 'Travel', icon: '🚗', color: '#8B5CF6', sortOrder: 4 },
  { name: 'Office Supplies', icon: '📎', color: '#6B7280', sortOrder: 5 },
  { name: 'Repairs & Maintenance', icon: '🔧', color: '#F97316', sortOrder: 6 },
  { name: 'Insurance', icon: '🛡️', color: '#0EA5E9', sortOrder: 7 },
  { name: 'Marketing', icon: '📣', color: '#EC4899', sortOrder: 8 },
  { name: 'Professional Fees', icon: '💼', color: '#14B8A6', sortOrder: 9 },
  { name: 'Miscellaneous', icon: '📦', color: '#9CA3AF', sortOrder: 10 },
]

export async function seedDefaultCategories(businessId: string) {
  await prisma.expenseCategory.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({
      businessId,
      name: c.name,
      icon: c.icon,
      color: c.color,
      sortOrder: c.sortOrder,
      isSystem: true,
    })),
    skipDuplicates: true,
  })

  return prisma.expenseCategory.findMany({
    where: { businessId },
    orderBy: { sortOrder: 'asc' },
    take: 50,
  })
}

export async function createExpenseCategory(
  businessId: string,
  data: CreateExpenseCategoryInput,
) {
  return prisma.expenseCategory.create({
    data: {
      businessId,
      name: data.name,
      icon: data.icon ?? null,
      color: data.color ?? '#6B7280',
      sortOrder: data.sortOrder ?? 0,
    },
  })
}

export async function listExpenseCategories(businessId: string) {
  return prisma.expenseCategory.findMany({
    where: { businessId, isActive: true },
    orderBy: [{ isSystem: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    take: 200,
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
      isSystem: true,
      sortOrder: true,
      _count: { select: { expenses: { where: { isDeleted: false } } } },
    },
  })
}

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

  return prisma.expense.create({
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
      createdBy: userId,
    },
    include: { category: { select: { id: true, name: true, icon: true, color: true } } },
  })
}

export async function updateExpense(
  businessId: string,
  expenseId: string,
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

  return prisma.expense.update({
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
    include: { category: { select: { id: true, name: true, icon: true, color: true } } },
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
  const { categoryId, from, to, paymentMode, page, limit } = query
  const skip = (page - 1) * limit

  const where = {
    businessId,
    isDeleted: false,
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

  await prisma.expense.update({
    where: { id: expenseId },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  return { deleted: true }
}

export async function getExpenseSummary(businessId: string, from?: Date, to?: Date) {
  const where = {
    businessId,
    isDeleted: false,
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
