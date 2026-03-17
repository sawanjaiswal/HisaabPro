/** Payment Tracking — Core model & API response types
 *
 * All monetary amounts stored in PAISE (integer).
 * Covers: sub-entities, summary, detail, list response, filters.
 */

import type {
  PaymentType,
  PaymentMode,
  PaymentDiscountType,
  PaymentSortBy,
  SyncStatus,
} from './payment-enums.types'

// ─── Sub-entities ────────────────────────────────────────────────────────────

/** Allocation of a payment to a specific invoice */
export interface PaymentAllocation {
  id: string
  invoiceId: string
  invoiceNumber: string
  /** Amount allocated to this invoice, in PAISE */
  amount: number
}

/** Discount applied at payment time (not on the invoice itself) */
export interface PaymentDiscount {
  id: string
  type: PaymentDiscountType
  /** Entered value: 0-100 for PERCENTAGE, paise for FIXED */
  value: number
  /** Resolved discount amount in PAISE */
  calculatedAmount: number
  reason: string | null
}

// ─── Payment Summary (list item) ─────────────────────────────────────────────

/** Lightweight shape used in list responses — no allocations/discount detail */
export interface PaymentSummary {
  id: string
  type: PaymentType
  partyId: string
  partyName: string
  /** Total payment amount in PAISE */
  amount: number
  /** ISO date string "YYYY-MM-DD" */
  date: string
  mode: PaymentMode
  referenceNumber: string | null
  notes: string | null
  allocationsCount: number
  hasDiscount: boolean
  /** Discount amount in PAISE (0 when hasDiscount is false) */
  discountAmount: number
  /** Portion of the payment not yet linked to any invoice, in PAISE */
  unallocatedAmount: number
  createdAt: string
}

// ─── Payment Detail (single record) ─────────────────────────────────────────

/** Full payment shape returned by GET /payments/:id */
export interface PaymentDetail {
  id: string
  /** Client-generated UUID for offline creation */
  offlineId: string
  type: PaymentType
  partyId: string
  partyName: string
  /** Total payment amount in PAISE */
  amount: number
  /** ISO date string "YYYY-MM-DD" */
  date: string
  mode: PaymentMode
  referenceNumber: string | null
  notes: string | null
  allocations: PaymentAllocation[]
  discount: PaymentDiscount | null
  /** Portion not linked to any invoice, in PAISE */
  unallocatedAmount: number
  /** Party's outstanding balance immediately after this payment was applied, in PAISE */
  partyOutstandingAfter: number
  createdAt: string
  syncStatus: SyncStatus
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

/** Response shape for GET /payments */
export interface PaymentListResponse {
  payments: PaymentSummary[]
  pagination: Pagination
  summary: {
    /** Sum of PAYMENT_IN amounts for the filtered set, in PAISE */
    totalIn: number
    /** Sum of PAYMENT_OUT amounts for the filtered set, in PAISE */
    totalOut: number
    /** totalIn - totalOut, in PAISE */
    net: number
  }
}

/** Response shape for DELETE /payments/:id */
export interface PaymentDeleteResponse {
  id: string
  deletedAt: string
  message: string
}

// ─── Payment Filters ──────────────────────────────────────────────────────────

/** Query parameters for GET /payments */
export interface PaymentFilters {
  page: number
  limit: number
  type?: PaymentType
  partyId?: string
  mode?: PaymentMode
  dateFrom?: string
  dateTo?: string
  sortBy: PaymentSortBy
  sortOrder: 'asc' | 'desc'
  search: string
}
