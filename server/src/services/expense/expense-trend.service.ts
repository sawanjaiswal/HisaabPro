/**
 * Expense Trend Service — monthly aggregation of CONFIRMED expenses.
 * Returns last N months bucketed by month with per-category breakdown.
 */

import { prisma } from '../../lib/prisma.js'
import { validationError } from '../../lib/errors.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TrendCategoryPoint {
  categoryId: string
  name: string
  icon: string | null
  color: string
  paise: number
}

export interface TrendMonthPoint {
  monthYmd: string   // YYYY-MM-01
  label: string      // "May 2026"
  totalPaise: number
  byCategory: TrendCategoryPoint[]
}

// ── Public API ─────────────────────────────────────────────────────────────

const MAX_MONTHS = 24

export async function getMonthlyTrend(
  businessId: string,
  months: number = 6,
): Promise<TrendMonthPoint[]> {
  if (months < 1 || months > MAX_MONTHS) {
    throw validationError(`months must be between 1 and ${MAX_MONTHS}`)
  }

  // Build month windows for last N months (inclusive of current month)
  const now = new Date()
  const windows = buildMonthWindows(now, months)

  if (windows.length === 0) return []

  const rangeFrom = windows[0].from
  const rangeTo = windows[windows.length - 1].to

  // Prisma groupBy doesn't support DATE_TRUNC, so we pull relevant rows and
  // bucket in JS (row count bounded by months × categories, typically < 5 k rows).
  const rows = await prisma.expense.findMany({
    where: {
      businessId,
      isDeleted: false,
      status: 'CONFIRMED',
      date: { gte: rangeFrom, lte: rangeTo },
    },
    select: {
      date: true,
      amount: true,
      categoryId: true,
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
    orderBy: { date: 'asc' },
  })

  // Bucket rows into month windows
  type CatMap = Map<string, { name: string; icon: string | null; color: string; paise: number }>
  const buckets = new Map<string, { total: number; cats: CatMap }>()

  for (const w of windows) {
    buckets.set(w.monthYmd, { total: 0, cats: new Map() })
  }

  for (const row of rows) {
    const monthYmd = toMonthYmd(row.date)
    const bucket = buckets.get(monthYmd)
    if (!bucket) continue

    const paise = row.amount
    bucket.total += paise

    const existing = bucket.cats.get(row.categoryId)
    if (existing) {
      existing.paise += paise
    } else {
      bucket.cats.set(row.categoryId, {
        name: row.category?.name ?? '',
        icon: row.category?.icon ?? null,
        color: row.category?.color ?? '#6B7280',
        paise,
      })
    }
  }

  return windows.map((w) => {
    const bucket = buckets.get(w.monthYmd)!
    const byCategory: TrendCategoryPoint[] = Array.from(bucket.cats.entries())
      .map(([categoryId, v]) => ({ categoryId, ...v }))
      .sort((a, b) => b.paise - a.paise)

    return {
      monthYmd: w.monthYmd,
      label: w.label,
      totalPaise: bucket.total,
      byCategory,
    }
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────

interface MonthWindow {
  monthYmd: string
  label: string
  from: Date
  to: Date
}

function buildMonthWindows(now: Date, months: number): MonthWindow[] {
  const windows: MonthWindow[] = []
  for (let i = months - 1; i >= 0; i--) {
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth() - i
    // JS Date handles negative months by rolling back year
    const d = new Date(Date.UTC(year, month, 1))
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth()

    const from = new Date(Date.UTC(y, m, 1))
    const to = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999))
    const monthYmd = `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-01`
    const label = from.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })

    windows.push({ monthYmd, label, from, to })
  }
  return windows
}

function toMonthYmd(date: Date): string {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
}
