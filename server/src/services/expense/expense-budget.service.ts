/**
 * Expense Budget Service — advisory per-category monthly budgets.
 * Never blocks expense creation. spentPaise reads CONFIRMED rows only.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import type { SetBudgetInput } from '../../schemas/expenses-upgrade.schemas.js'

// ── Types ──────────────────────────────────────────────────────────────────

export type BudgetSeverity = 'ok' | 'warn' | 'over'

export interface BudgetUtilizationItem {
  id: string
  businessId: string
  categoryId: string | null
  category: { id: string; name: string; icon: string | null; color: string } | null
  monthYmd: string
  amountPaise: number
  spentPaise: number
  percent: number
  severity: BudgetSeverity
  createdAt: Date
  updatedAt: Date
}

// ── Internal helpers ───────────────────────────────────────────────────────

/** Month window for a monthYmd string (e.g. "2026-05-01"). */
function monthWindow(monthYmd: string): { from: Date; to: Date } {
  // monthYmd = YYYY-MM-01
  const [y, m] = monthYmd.split('-').map(Number)
  const from = new Date(Date.UTC(y, m - 1, 1))
  const to = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)) // last ms of month
  return { from, to }
}

function severity(percent: number): BudgetSeverity {
  if (percent >= 100) return 'over'
  if (percent >= 85) return 'warn'
  return 'ok'
}

/**
 * Aggregate CONFIRMED expense totals for a businessId + monthYmd.
 * Returns a Map of categoryId → spentPaise, plus an 'overall' key.
 */
async function spentByCategory(
  businessId: string,
  monthYmd: string,
): Promise<{ overall: number; byCategoryId: Map<string, number> }> {
  const { from, to } = monthWindow(monthYmd)

  const groups = await prisma.expense.groupBy({
    by: ['categoryId'],
    where: {
      businessId,
      isDeleted: false,
      status: 'CONFIRMED',
      date: { gte: from, lte: to },
    },
    _sum: { amount: true },
  })

  const byCategoryId = new Map<string, number>()
  let overall = 0
  for (const g of groups) {
    const paise = g._sum.amount ?? 0
    byCategoryId.set(g.categoryId, paise)
    overall += paise
  }

  return { overall, byCategoryId }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function listBudgets(
  businessId: string,
  monthYmd: string,
): Promise<BudgetUtilizationItem[]> {
  const [budgets, spent] = await Promise.all([
    prisma.expenseBudget.findMany({
      where: { businessId, monthYmd, isDeleted: false },
      select: {
        id: true,
        businessId: true,
        categoryId: true,
        category: { select: { id: true, name: true, icon: true, color: true } },
        monthYmd: true,
        amountPaise: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ categoryId: 'asc' }],
    }),
    spentByCategory(businessId, monthYmd),
  ])

  return budgets.map((b) => {
    const spentPaise = b.categoryId == null
      ? spent.overall
      : (spent.byCategoryId.get(b.categoryId) ?? 0)
    const percent = b.amountPaise > 0 ? Math.round((spentPaise / b.amountPaise) * 100) : 0

    return {
      ...b,
      spentPaise,
      percent,
      severity: severity(percent),
    }
  })
}

export async function getBudgetUtilization(
  businessId: string,
  monthYmd: string,
): Promise<BudgetUtilizationItem[]> {
  return listBudgets(businessId, monthYmd)
}

export async function setBudget(
  businessId: string,
  userId: string,
  input: SetBudgetInput,
): Promise<BudgetUtilizationItem> {
  // Validate categoryId belongs to business (if provided)
  if (input.categoryId) {
    const cat = await prisma.expenseCategory.findFirst({
      where: { id: input.categoryId, businessId, isActive: true, isDeleted: false },
      select: { id: true },
    })
    if (!cat) throw validationError('Expense category not found or inactive')
  }

  const budget = await prisma.expenseBudget.upsert({
    where: {
      businessId_categoryId_monthYmd: {
        businessId,
        categoryId: input.categoryId ?? null as unknown as string,
        monthYmd: input.monthYmd,
      },
    },
    create: {
      businessId,
      categoryId: input.categoryId ?? null,
      monthYmd: input.monthYmd,
      amountPaise: input.amountPaise,
      createdBy: userId,
    },
    update: {
      amountPaise: input.amountPaise,
      isDeleted: false,
      deletedAt: null,
    },
    select: {
      id: true,
      businessId: true,
      categoryId: true,
      category: { select: { id: true, name: true, icon: true, color: true } },
      monthYmd: true,
      amountPaise: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  // Return with live utilization
  const spent = await spentByCategory(businessId, input.monthYmd)
  const spentPaise = budget.categoryId == null
    ? spent.overall
    : (spent.byCategoryId.get(budget.categoryId) ?? 0)
  const percent = budget.amountPaise > 0 ? Math.round((spentPaise / budget.amountPaise) * 100) : 0

  return { ...budget, spentPaise, percent, severity: severity(percent) }
}

export async function deleteBudget(
  businessId: string,
  id: string,
): Promise<{ deleted: true }> {
  const existing = await prisma.expenseBudget.findFirst({
    where: { id, businessId, isDeleted: false },
    select: { id: true },
  })
  if (!existing) throw notFoundError('ExpenseBudget')

  await prisma.expenseBudget.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  return { deleted: true }
}
