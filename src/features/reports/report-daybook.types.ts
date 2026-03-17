/** Day Book — TypeScript types
 *
 * All monetary amounts are in PAISE (integer).
 */

import type { Pagination } from './report-shared.types'

// ─── Day Book ──────────────────────────────────────────────────────────────────

/** All transaction types that appear in the day book */
export type DayBookTransactionType =
  | 'sale'
  | 'purchase'
  | 'payment_in'
  | 'payment_out'
  | 'expense'
  | 'stock_adjustment'

/** Query parameters for the day book endpoint */
export interface DayBookFilters {
  date: string               // ISO date, e.g. "2026-03-15"
  type?: DayBookTransactionType
  cursor?: string
  limit: number
}

/** Aggregate totals for each transaction type on the selected day */
export interface DayBookSummary {
  totalSales: { count: number; amount: number }        // paise
  totalPurchases: { count: number; amount: number }    // paise
  paymentsIn: { count: number; amount: number }        // paise
  paymentsOut: { count: number; amount: number }       // paise
  expenses: { count: number; amount: number }          // paise
  stockAdjustments: { count: number; amount: number }  // paise (can be negative)
  netCashFlow: number                                  // paise
}

/** A single transaction entry in the day book */
export interface DayBookTransaction {
  id: string
  time: string               // "HH:MM" in local time
  type: DayBookTransactionType
  description: string
  reference: string          // Document number or reference string
  referenceId: string        // Source document ID
  partyName: string
  amount: number             // paise
  /** Populated for payment_in / payment_out only */
  mode?: string
}

/** Full response shape from GET /reports/day-book */
export interface DayBookResponse {
  success: boolean
  data: {
    date: string             // ISO date
    dayLabel: string         // "Saturday, 15 March 2026"
    summary: DayBookSummary
    transactions: DayBookTransaction[]
    navigation: {
      prevDate: string | null  // ISO date or null if no history
      nextDate: string | null  // ISO date or null if date is today/future
    }
  }
  meta: Pagination
}
