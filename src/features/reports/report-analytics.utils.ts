/** Reports — pure helpers shared by every analytics header (#15, #16, #69, …).
 *
 * No hooks, no state, no side effects. All money is PAISE (integer).
 * Promoted out of `invoice-report.utils.ts` when #16 needed the same delta,
 * range label and chart mapping — one copy, four pages.
 */

import { formatDateShort } from './report.utils'

/** A signed percentage delta against the previous period. */
export interface PeriodDelta {
  /** Absolute percentage, already rounded — render with the `up` flag */
  percent: number
  up: boolean
  /** False when there is nothing to compare against (previous period empty) */
  comparable: boolean
}

/** Any `{ date, amount }` series — invoice totals, net profit, cash flow. */
export interface TrendPoint {
  date: string
  amount: number
}

/**
 * Percentage change of `current` vs `previous`.
 *
 * A zero previous total is NOT treated as "+100%" — there is no meaningful
 * baseline, so the caller hides the chip instead of showing a fake spike.
 * `previous` is compared on magnitude so a loss-to-profit swing still reads.
 */
export function periodDelta(current: number, previous: number): PeriodDelta {
  if (previous === 0) return { percent: 0, up: current > 0, comparable: false }
  const change = ((current - previous) / Math.abs(previous)) * 100
  return {
    percent: Math.abs(Math.round(change)),
    up: change >= 0,
    comparable: true,
  }
}

/** Share of `value` in `total`, rounded to a whole percent. */
export function sharePercent(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((value / total) * 100)
}

/** Chart values for `AreaChart` (which normalises internally). */
export function trendValues(series: TrendPoint[]): number[] {
  return series.map((point) => point.amount)
}

/** Edge labels for the trend x-axis: "1 Jun" … "8 Jun". */
export function trendLabels(series: TrendPoint[]): string[] {
  return series.map((point) => formatDateShort(point.date))
}

/**
 * Human range label for the hero: "1 Jun – 8 Jun 2026".
 * Falls back to a single date when from and to are the same day.
 */
export function formatRangeLabel(from?: string, to?: string): string {
  if (!from || !to) return ''
  const year = new Date(to).toLocaleDateString('en-IN', { year: 'numeric' })
  if (from === to) return `${formatDateShort(from)} ${year}`
  return `${formatDateShort(from)} – ${formatDateShort(to)} ${year}`
}
