/** Period grouping for archetype-A list pages (mockups #1, #10, #41, …).
 *
 * Redesigned list pages group their rows by a calendar period with a
 * per-period total and a sparkline of those totals. Sales (#1) and expenses
 * (#10) group by DAY ("Today", "Yesterday", "7 Jun 2025"); payment history
 * (#41) and purchases (#11) group by MONTH ("This Month", "May 2025"). The
 * maths is identical either way, so it lives here once and each feature
 * supplies its own date/amount accessors plus the granularity its mockup uses.
 *
 * Pure — no i18n. `isCurrent` / `isPrevious` are flags the caller maps to
 * `t.dateToday`/`t.thisMonth` and `t.dateYesterday`/`t.lastMonth`.
 */

import { toLocalISODate } from './format'

export type PeriodGranularity = 'day' | 'month'

export interface PeriodGroup<T> {
  /** Local calendar key: `YYYY-MM-DD` for days, `YYYY-MM` for months. */
  key: string
  /** Absolute label, e.g. "18 Jul 2026" / "May 2026". Ignored when isCurrent/isPrevious. */
  label: string
  granularity: PeriodGranularity
  /** Today, or the current month. */
  isCurrent: boolean
  /** Yesterday, or the previous month. */
  isPrevious: boolean
  /** Sum of the group's amounts, in PAISE. */
  totalPaise: number
  items: T[]
}

function keyOf(date: Date, granularity: PeriodGranularity): string {
  const iso = toLocalISODate(date)
  return granularity === 'month' ? iso.slice(0, 7) : iso
}

function labelOf(date: Date, granularity: PeriodGranularity): string {
  return date.toLocaleDateString(
    'en-IN',
    granularity === 'month'
      ? { month: 'long', year: 'numeric' }
      : { day: 'numeric', month: 'short', year: 'numeric' },
  )
}

/** The period immediately before `now` — yesterday, or last month. */
function previousOf(now: Date, granularity: PeriodGranularity): Date {
  const prev = new Date(now)
  if (granularity === 'month') {
    // Anchor to the 1st first: 31 Mar minus a month would otherwise land in March.
    prev.setDate(1)
    prev.setMonth(prev.getMonth() - 1)
  } else {
    prev.setDate(prev.getDate() - 1)
  }
  return prev
}

/**
 * Group items into local calendar periods, newest period first. Item order
 * inside a group is the order they arrived in (the API's sort is preserved).
 */
export function groupByPeriod<T>(
  items: T[],
  getDate: (item: T) => string | Date,
  getAmountPaise: (item: T) => number,
  granularity: PeriodGranularity = 'day',
  now: Date = new Date(),
): PeriodGroup<T>[] {
  const currentKey = keyOf(now, granularity)
  const previousKey = keyOf(previousOf(now, granularity), granularity)

  const byKey = new Map<string, PeriodGroup<T>>()

  for (const item of items) {
    const raw = getDate(item)
    const date = typeof raw === 'string' ? new Date(raw) : raw
    if (Number.isNaN(date.getTime())) continue

    const key = keyOf(date, granularity)
    let group = byKey.get(key)
    if (!group) {
      group = {
        key,
        label: labelOf(date, granularity),
        granularity,
        isCurrent: key === currentKey,
        isPrevious: key === previousKey,
        totalPaise: 0,
        items: [],
      }
      byKey.set(key, group)
    }
    group.totalPaise += getAmountPaise(item)
    group.items.push(item)
  }

  return [...byKey.values()].sort((a, b) => (a.key < b.key ? 1 : -1))
}

/**
 * Per-period totals as a sparkline series, oldest → newest. Groups arrive
 * newest-first, so this reverses them.
 */
export function toPeriodTotalsSeries<T>(groups: PeriodGroup<T>[]): number[] {
  return groups.map((g) => g.totalPaise).reverse()
}
