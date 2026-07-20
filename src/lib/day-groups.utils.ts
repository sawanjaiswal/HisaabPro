/** Day grouping for archetype-A list pages (mockups #1, #41, …).
 *
 * Every redesigned list page groups its rows by local calendar day with a
 * per-day total and a sparkline of those totals. The maths is identical across
 * invoices, payments, expenses and purchases, so it lives here once and each
 * feature supplies its own date/amount accessors.
 *
 * Pure — no i18n. `isToday` / `isYesterday` are flags the caller maps to
 * `t.dateToday` / `t.dateYesterday`.
 */

import { toLocalISODate } from './format'

export interface DayGroup<T> {
  /** Local calendar day, YYYY-MM-DD. */
  key: string
  /** Absolute label, e.g. "18 Jul 2026". Ignore when isToday/isYesterday. */
  label: string
  isToday: boolean
  isYesterday: boolean
  /** Sum of the group's amounts, in PAISE. */
  totalPaise: number
  items: T[]
}

function absoluteLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Group items into local calendar days, newest day first. Item order inside a
 * group is the order they arrived in (the API's sort is preserved).
 */
export function groupByDay<T>(
  items: T[],
  getDate: (item: T) => string | Date,
  getAmountPaise: (item: T) => number,
  now: Date = new Date(),
): DayGroup<T>[] {
  const todayKey = toLocalISODate(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = toLocalISODate(yesterday)

  const byKey = new Map<string, DayGroup<T>>()

  for (const item of items) {
    const raw = getDate(item)
    const date = typeof raw === 'string' ? new Date(raw) : raw
    if (Number.isNaN(date.getTime())) continue

    const key = toLocalISODate(date)
    let group = byKey.get(key)
    if (!group) {
      group = {
        key,
        label: absoluteLabel(date),
        isToday: key === todayKey,
        isYesterday: key === yesterdayKey,
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
 * Per-day totals as a sparkline series, oldest → newest. Groups arrive
 * newest-first, so this reverses them.
 */
export function toDailyTotalsSeries<T>(groups: DayGroup<T>[]): number[] {
  return groups.map((g) => g.totalPaise).reverse()
}
