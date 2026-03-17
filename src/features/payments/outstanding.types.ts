/** Payment Tracking — Outstanding types
 *
 * Data shapes for the outstanding (receivable/payable) feature.
 * All monetary amounts in PAISE (integer).
 */

import type {
  OutstandingType,
  OutstandingSortBy,
  OutstandingPartyType,
} from './payment-enums.types'
import type { Pagination } from './payment-models.types'

// ─── Outstanding Models ──────────────────────────────────────────────────────

/** Aging breakdown — all values in PAISE */
export interface OutstandingAging {
  current: number
  days1to30: number
  days31to60: number
  days61to90: number
  days90plus: number
}

/** One party row in the outstanding list */
export interface OutstandingParty {
  partyId: string
  partyName: string
  partyPhone: string
  partyType: OutstandingPartyType
  /** Absolute outstanding in PAISE (positive = receivable, negative = payable) */
  outstanding: number
  /** Resolved direction for this party in the current filter context */
  type: 'RECEIVABLE' | 'PAYABLE'
  invoiceCount: number
  oldestDueDate: string | null
  daysOverdue: number
  lastPaymentDate: string | null
  lastReminderDate: string | null
  aging: OutstandingAging
}

/** Aggregate totals shown at the top of the outstanding screen */
export interface OutstandingTotals {
  /** Total receivable across all parties, in PAISE */
  totalReceivable: number
  /** Total payable across all parties, in PAISE */
  totalPayable: number
  /** totalReceivable - totalPayable, in PAISE */
  net: number
  /** Receivable amount where daysOverdue > 0, in PAISE */
  overdueReceivable: number
  /** Payable amount where daysOverdue > 0, in PAISE */
  overduePayable: number
}

/** Response shape for GET /outstanding */
export interface OutstandingListResponse {
  parties: OutstandingParty[]
  pagination: Pagination
  totals: OutstandingTotals
  /** Portfolio-level aging across all matched parties */
  aging: OutstandingAging
}

/** A single unpaid / partially paid invoice shown in a party's outstanding detail */
export interface OutstandingInvoice {
  id: string
  number: string
  /** ISO date string "YYYY-MM-DD" */
  date: string
  dueDate: string | null
  /** Original invoice total, in PAISE */
  total: number
  /** Amount paid so far, in PAISE */
  paid: number
  /** Discount applied at payment time, in PAISE */
  discount: number
  /** Remaining balance due, in PAISE */
  due: number
  daysOverdue: number
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'OVERDUE'
  /** Payments already linked to this invoice */
  payments: Array<{
    id: string
    /** ISO date string "YYYY-MM-DD" */
    date: string
    /** Amount allocated in PAISE */
    amount: number
    mode: string
  }>
}

/** Full outstanding breakdown for a single party */
export interface OutstandingPartyDetail {
  partyId: string
  partyName: string
  /** Current net outstanding in PAISE */
  outstanding: number
  invoices: OutstandingInvoice[]
  /** Advance (unallocated) balance available, in PAISE */
  advanceBalance: number
  aging: OutstandingAging
}

/** Query parameters for GET /outstanding */
export interface OutstandingFilters {
  type: OutstandingType
  overdue: boolean
  sortBy: OutstandingSortBy
  sortOrder: 'asc' | 'desc'
  search: string
  page: number
  limit: number
}
