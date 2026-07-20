/** Expense categories — seed (idempotent), create, list. */
import { prisma } from '../../lib/prisma.js'
import type { CreateExpenseCategoryInput } from '../../schemas/expense.schemas.js'

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
  const rows = await prisma.expenseCategory.findMany({
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

  // Flatten Prisma's _count so the client type stays a plain category.
  return rows.map(({ _count, ...category }) => ({
    ...category,
    expenseCount: _count.expenses,
  }))
}
