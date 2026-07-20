/** Party Ledger — pure helpers for the mockup row-list view */

import type { TransactionDirection } from '@/components/ui/TransactionRow'
import type { LedgerRow } from './ledger.types'

export interface LedgerMonthGroup {
  /** Stable key, e.g. "2025-06". */
  key: string
  /** Human month label, e.g. "June 2025". */
  label: string
  /** Balance in PAISE just before this month's first row. */
  openingBalance: number
  rows: LedgerRow[]
}

/** Direction + primary amount (paise) for a single ledger row. */
export function rowDirection(row: LedgerRow): TransactionDirection {
  return row.dr > 0 ? 'debit' : 'credit'
}

export function rowAmountPaise(row: LedgerRow): number {
  return row.dr > 0 ? row.dr : row.cr
}

function monthKey(iso: string): string {
  return iso.slice(0, 7) // "YYYY-MM"
}

function monthLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(d)
}

/**
 * Group ledger rows by calendar month, preserving the incoming order.
 * Each group's `openingBalance` is the running balance immediately before its
 * first row: the ledger opening for the first group, else the previous row's
 * running balance.
 */
export function groupLedgerByMonth(
  rows: LedgerRow[],
  openingBalance: number,
): LedgerMonthGroup[] {
  const groups: LedgerMonthGroup[] = []
  let prevBalance = openingBalance

  for (const row of rows) {
    const key = monthKey(row.date)
    let group = groups[groups.length - 1]
    if (!group || group.key !== key) {
      group = { key, label: monthLabel(row.date), openingBalance: prevBalance, rows: [] }
      groups.push(group)
    }
    group.rows.push(row)
    prevBalance = row.runningBalance
  }

  return groups
}
