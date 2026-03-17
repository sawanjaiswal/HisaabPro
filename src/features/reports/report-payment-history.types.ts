/** Payment History Report — TypeScript types
 *
 * All monetary amounts are in PAISE (integer).
 */

import type { Pagination, ReportSortBy } from './report-shared.types'

// ─── Payment History Report ────────────────────────────────────────────────────

/** Direction of payment flow */
export type PaymentHistoryType = 'in' | 'out'

/** Mode of payment */
export type PaymentHistoryMode = 'cash' | 'upi' | 'bank_transfer' | 'cheque'

/** Grouping options specific to payment history */
export type PaymentHistoryGroupBy = 'none' | 'day' | 'party' | 'mode'

/** Query parameters for the payment history endpoint */
export interface PaymentHistoryFilters {
  from?: string              // ISO date
  to?: string                // ISO date
  partyId?: string
  mode?: PaymentHistoryMode
  type?: PaymentHistoryType
  groupBy: PaymentHistoryGroupBy
  sortBy: ReportSortBy
  cursor?: string
  limit: number
}

/** Aggregate totals shown in the summary bar */
export interface PaymentHistorySummary {
  totalReceived: number      // paise — sum of all 'in' payments
  totalPaid: number          // paise — sum of all 'out' payments
  net: number                // paise — totalReceived - totalPaid
  countIn: number
  countOut: number
}

/** A single payment row in the flat (ungrouped) list */
export interface PaymentHistoryItem {
  id: string
  date: string               // ISO date
  partyId: string
  partyName: string
  type: PaymentHistoryType
  mode: string
  amount: number             // paise
  reference: string
  invoiceId: string | null
  invoiceNumber: string | null
  notes: string
}

/** A collapsed group when groupBy is set to a non-'none' value */
export interface PaymentHistoryGroup {
  key: string
  label: string
  totalReceived: number      // paise
  totalPaid: number          // paise
  count: number
  items: PaymentHistoryItem[]
}

/** Full response shape from GET /reports/payments */
export interface PaymentHistoryResponse {
  success: boolean
  data: {
    summary: PaymentHistorySummary
    /** Present when groupBy is 'none' */
    items?: PaymentHistoryItem[]
    /** Present when groupBy is anything other than 'none' */
    groups?: PaymentHistoryGroup[]
  }
  meta: Pagination
}
