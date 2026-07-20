/**
 * Invoice Report — trend series + previous-period comparison.
 *
 * Split out of report-invoice.ts: the list query and the analytics aggregate
 * are two responsibilities with different cost profiles (the trend runs only
 * on the first page, never on load-more).
 *
 * All amounts are PAISE (integer).
 */

import { prisma } from '../../lib/prisma.js'

/** Never return more points than this — a year-long range downsamples into buckets. */
const MAX_POINTS = 30

export interface InvoiceTrendPoint {
  /** Bucket start, ISO date (YYYY-MM-DD) */
  date: string
  /** Sum of grandTotal for the bucket, paise */
  amount: number
}

export interface InvoiceTrend {
  series: InvoiceTrendPoint[]
  /** Total for the same-length window immediately before `from`, paise */
  previousTotal: number
}

/** Serialize a Date to YYYY-MM-DD (UTC — documentDate is stored day-aligned). */
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Whole days between two ISO dates, inclusive of both ends. */
function dayCount(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.max(1, Math.floor(ms / 86_400_000) + 1)
}

/**
 * Bucket day totals into at most MAX_POINTS evenly-sized chunks.
 * Chunks sum their days, so the series total always equals the range total.
 */
function downsample(points: InvoiceTrendPoint[]): InvoiceTrendPoint[] {
  if (points.length <= MAX_POINTS) return points

  const size = Math.ceil(points.length / MAX_POINTS)
  const out: InvoiceTrendPoint[] = []
  for (let i = 0; i < points.length; i += size) {
    const chunk = points.slice(i, i + size)
    out.push({
      date: chunk[0].date,
      amount: chunk.reduce((sum, p) => sum + p.amount, 0),
    })
  }
  return out
}

/**
 * Build the daily trend series for the current range and the total for the
 * immediately preceding window of the same length.
 *
 * `where` is the SAME filter object used by the list query (already scoped to
 * businessId + document type + status filters) — the date clause is replaced
 * per window so the comparison is apples-to-apples.
 */
export async function getInvoiceTrend(
  where: Record<string, unknown>,
  from: string,
  to: string
): Promise<InvoiceTrend> {
  const fromDate = new Date(from)
  const toDate = new Date(to)
  const days = dayCount(fromDate, toDate)

  const prevTo = new Date(fromDate.getTime() - 86_400_000)
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86_400_000)

  const [rows, previous] = await Promise.all([
    prisma.document.groupBy({
      by: ['documentDate'],
      where: { ...where, documentDate: { gte: fromDate, lte: toDate } },
      _sum: { grandTotal: true },
    }),
    prisma.document.aggregate({
      where: { ...where, documentDate: { gte: prevFrom, lte: prevTo } },
      _sum: { grandTotal: true },
    }),
  ])

  // documentDate is a timestamp — collapse to day buckets before filling gaps.
  const byDay = new Map<string, number>()
  for (const row of rows) {
    const key = toISODate(row.documentDate)
    byDay.set(key, (byDay.get(key) ?? 0) + (row._sum.grandTotal ?? 0))
  }

  const filled: InvoiceTrendPoint[] = []
  for (let i = 0; i < days; i++) {
    const key = toISODate(new Date(fromDate.getTime() + i * 86_400_000))
    filled.push({ date: key, amount: byDay.get(key) ?? 0 })
  }

  return {
    series: downsample(filled),
    previousTotal: previous._sum.grandTotal ?? 0,
  }
}
