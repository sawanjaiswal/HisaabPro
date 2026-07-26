/**
 * Dashboard trend — the numbers behind the home hero, its metric tiles and the
 * business-overview carousel.
 *
 * Everything here is real money the business actually moved. The hero used to
 * render a hardcoded ₹52,300 with a +18% chip on a fabricated 31-day curve; a
 * billing app that invents a sales figure is worse than one that shows nothing,
 * because the shopkeeper cannot tell which screens are lying.
 *
 * All amounts in PAISE. Two raw-SQL sites (day bucketing needs date_trunc,
 * which Prisma's groupBy cannot express) — both carry an explicit
 * "businessId" = $1 predicate, since raw SQL bypasses the scoped-client
 * extension. Registered in scripts/scoped/raw-sql-audit.allowlist.json.
 */

import { prisma } from '../../lib/prisma.js'

/** Days in the current window; the same length is read again for the delta. */
export const TREND_DAYS = 30

export interface TrendMetric {
  /** Total across the current window (paise). */
  total: number
  /** Total across the window before it (paise) — what the delta compares to. */
  previousTotal: number
  /** Percent change vs the previous window; null when there is nothing to compare to. */
  deltaPct: number | null
  /** One entry per day of the current window, oldest first (paise). */
  series: number[]
}

export interface DashboardTrend {
  days: number
  sales: TrendMetric
  collections: TrendMetric
  expenses: TrendMetric
  /** Cash actually in the drawer: every CASH payment in, less every CASH payment out. */
  cashInHand: number
  /** Today's sales against yesterday's — the hero's headline and its chip. */
  todayVsYesterday: { today: number; yesterday: number; deltaPct: number | null }
}

interface DayRow {
  day: Date
  bucket: string
  total: bigint | number
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Local-midnight key, so bucketing matches the shopkeeper's day, not UTC's. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function deltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

/**
 * Turn day-bucketed rows into a dense series (a day with no sales is a zero in
 * the chart, not a missing point that shifts the curve left).
 */
function toMetric(rows: DayRow[], bucket: string, from: Date, prevFrom: Date): TrendMetric {
  const byDay = new Map<string, number>()
  for (const row of rows) {
    if (row.bucket !== bucket) continue
    byDay.set(dayKey(new Date(row.day)), Number(row.total))
  }

  const series: number[] = []
  for (let i = 0; i < TREND_DAYS; i++) {
    const d = new Date(from.getTime() + i * 86_400_000)
    series.push(byDay.get(dayKey(d)) ?? 0)
  }

  let previousTotal = 0
  for (let i = 0; i < TREND_DAYS; i++) {
    const d = new Date(prevFrom.getTime() + i * 86_400_000)
    previousTotal += byDay.get(dayKey(d)) ?? 0
  }

  const total = series.reduce((sum, n) => sum + n, 0)
  return { total, previousTotal, deltaPct: deltaPct(total, previousTotal), series }
}

export async function getDashboardTrend(businessId: string): Promise<DashboardTrend> {
  const today = startOfDay(new Date())
  const from = new Date(today.getTime() - (TREND_DAYS - 1) * 86_400_000)
  const prevFrom = new Date(from.getTime() - TREND_DAYS * 86_400_000)

  const [salesRows, paymentRows, cashIn, cashOut] = await Promise.all([
    prisma.$queryRaw<DayRow[]>`
      SELECT date_trunc('day', "documentDate") AS day,
             'sales'::text AS bucket,
             SUM("grandTotal")::bigint AS total
      FROM "Document"
      WHERE "businessId" = ${businessId}
        AND "type" = 'SALE_INVOICE'
        AND "status" IN ('SAVED', 'SHARED')
        AND "deletedAt" IS NULL
        AND "documentDate" >= ${prevFrom}
      GROUP BY 1
    `,

    prisma.$queryRaw<DayRow[]>`
      SELECT date_trunc('day', "date") AS day,
             CASE WHEN "type" = 'PAYMENT_IN' THEN 'collections' ELSE 'expenses' END AS bucket,
             SUM("amount")::bigint AS total
      FROM "Payment"
      WHERE "businessId" = ${businessId}
        AND "isDeleted" = false
        AND "type" IN ('PAYMENT_IN', 'PAYMENT_OUT')
        AND "date" >= ${prevFrom}
      GROUP BY 1, 2
    `,

    prisma.payment.aggregate({
      where: { businessId, isDeleted: false, type: 'PAYMENT_IN', mode: 'CASH' },
      _sum: { amount: true },
    }),

    prisma.payment.aggregate({
      where: { businessId, isDeleted: false, type: 'PAYMENT_OUT', mode: 'CASH' },
      _sum: { amount: true },
    }),
  ])

  const sales = toMetric(salesRows, 'sales', from, prevFrom)
  const todaySales = sales.series[TREND_DAYS - 1] ?? 0
  const yesterdaySales = sales.series[TREND_DAYS - 2] ?? 0

  return {
    days: TREND_DAYS,
    sales,
    collections: toMetric(paymentRows, 'collections', from, prevFrom),
    expenses: toMetric(paymentRows, 'expenses', from, prevFrom),
    cashInHand: (cashIn._sum.amount ?? 0) - (cashOut._sum.amount ?? 0),
    todayVsYesterday: {
      today: todaySales,
      yesterday: yesterdaySales,
      deltaPct: deltaPct(todaySales, yesterdaySales),
    },
  }
}
