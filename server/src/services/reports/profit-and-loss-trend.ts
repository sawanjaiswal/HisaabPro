/**
 * Profit & Loss — trend series + previous-period comparison
 *
 * Two separate questions, answered separately:
 *   1. "how did we do vs last period?"  → one exact aggregate over the mirrored window
 *   2. "what did the curve look like?"  → per-day net profit inside the window
 *
 * (1) reuses the same account-movement aggregate the statement itself uses, so the
 * delta can never disagree with the number above it. (2) needs day granularity,
 * which Prisma's groupBy cannot express across a relation, so the lines are read
 * and bucketed in JS — guarded by a row count so a huge period degrades to
 * "no chart" instead of a chart built from a truncated read.
 */

import { prisma } from '../../lib/prisma.js'
import { getAccountMovements, REPORT_ROW_LIMIT } from './helpers.js'

const MAX_POINTS = 30
const MS_PER_DAY = 86_400_000

export interface ProfitLossTrendPoint {
  /** ISO date (YYYY-MM-DD) */
  date: string
  /** Net profit for the bucket, in paise (may be negative) */
  amount: number
}

export interface ProfitLossTrend {
  series: ProfitLossTrendPoint[]
  /** Net profit of the equally-long window immediately before `from` */
  previousNetProfit: number
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dayCount(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY) + 1
}

/** Collapse a long daily series into at most MAX_POINTS summed buckets. */
function downsample(points: ProfitLossTrendPoint[]): ProfitLossTrendPoint[] {
  if (points.length <= MAX_POINTS) return points
  const size = Math.ceil(points.length / MAX_POINTS)
  const out: ProfitLossTrendPoint[] = []
  for (let i = 0; i < points.length; i += size) {
    const chunk = points.slice(i, i + size)
    out.push({
      date: chunk[0].date,
      amount: chunk.reduce((sum, p) => sum + p.amount, 0),
    })
  }
  return out
}

/** Net profit of the whole window, from the same movements the statement uses. */
async function netProfitFor(businessId: string, from: Date, to: Date): Promise<number> {
  const movements = await getAccountMovements(businessId, from, to, ['INCOME', 'EXPENSE'])
  return movements.reduce((sum, m) => {
    // INCOME is credit-normal, EXPENSE debit-normal; both fold into one signed total.
    const signed =
      m.accountType === 'INCOME' ? m.netCredit - m.netDebit : -(m.netDebit - m.netCredit)
    return sum + signed
  }, 0)
}

/** Per-day net profit inside the window, gap-filled and downsampled. */
async function dailySeries(
  businessId: string,
  from: Date,
  to: Date,
): Promise<ProfitLossTrendPoint[]> {
  const where = {
    journalEntry: { businessId, status: 'POSTED' as const, date: { gte: from, lte: to } },
    account: { type: { in: ['INCOME', 'EXPENSE'] }, isActive: true },
  }

  // A truncated read would draw a curve that quietly disagrees with the totals,
  // so an oversized period gets no chart rather than a wrong one.
  const lineCount = await prisma.journalEntryLine.count({ where })
  if (lineCount > REPORT_ROW_LIMIT) return []

  const lines = await prisma.journalEntryLine.findMany({
    where,
    select: {
      debit: true,
      credit: true,
      journalEntry: { select: { date: true } },
      account: { select: { type: true } },
    },
  })

  const byDay = new Map<string, number>()
  for (const line of lines) {
    const key = toISODate(line.journalEntry.date)
    const debit = Number(line.debit ?? 0)
    const credit = Number(line.credit ?? 0)
    const signed = line.account.type === 'INCOME' ? credit - debit : -(debit - credit)
    byDay.set(key, (byDay.get(key) ?? 0) + signed)
  }

  const days = dayCount(from, to)
  const filled: ProfitLossTrendPoint[] = []
  for (let i = 0; i < days; i += 1) {
    const date = toISODate(new Date(from.getTime() + i * MS_PER_DAY))
    filled.push({ date, amount: byDay.get(date) ?? 0 })
  }

  return downsample(filled)
}

export async function getProfitLossTrend(
  businessId: string,
  from: Date,
  to: Date,
): Promise<ProfitLossTrend> {
  const days = dayCount(from, to)
  const prevTo = new Date(from.getTime() - MS_PER_DAY)
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * MS_PER_DAY)

  const [series, previousNetProfit] = await Promise.all([
    dailySeries(businessId, from, to),
    netProfitFor(businessId, prevFrom, prevTo),
  ])

  return { series, previousNetProfit }
}
