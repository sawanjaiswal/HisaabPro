/** Payment Tracking — Type definitions
 *
 * All monetary amounts stored in PAISE (integer).
 * Covers: Payment In/Out, invoice allocations, discounts,
 * outstanding with aging buckets, and payment reminders.
 *
 * PRD: payment-tracking-PLAN.md
 */

// ─── Enums / union types ────────────────────────────────────────────────────

/** Direction of money movement relative to the business */
export type PaymentType = 'PAYMENT_IN' | 'PAYMENT_OUT'

/** How the payment was made */
export type PaymentMode =
  | 'CASH'
  | 'UPI'
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'NEFT_RTGS_IMPS'
  | 'CREDIT_CARD'
  | 'OTHER'

/** Whether the discount value is a percent or a fixed paise amount */
export type PaymentDiscountType = 'PERCENTAGE' | 'FIXED'

/** Fields available to sort the payment list by */
export type PaymentSortBy = 'date' | 'amount' | 'createdAt'

/** Lifecycle state of a payment record */
export type PaymentRecordStatus = 'RECORDED' | 'DELETED'

/** Offline sync state — mirrors the pattern used in invoices */
export type SyncStatus = 'SYNCED' | 'PENDING' | 'CONFLICT' | 'FAILED'

// ─── Reminder enums ──────────────────────────────────────────────────────────

/** Reminder lifecycle state (see PRD §3 state machine) */
export type ReminderStatus =
  | 'SCHEDULED'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'PERMANENTLY_FAILED'
  | 'ACKNOWLEDGED'

/** Delivery channel for a reminder */
export type ReminderChannel = 'WHATSAPP' | 'SMS' | 'PUSH'

// ─── Outstanding enums ───────────────────────────────────────────────────────

/** Which side of the ledger to show in the outstanding list */
export type OutstandingType = 'RECEIVABLE' | 'PAYABLE' | 'ALL'

/** Fields available to sort the outstanding list by */
export type OutstandingSortBy = 'amount' | 'name' | 'daysOverdue'

/** Party role in the context of outstanding — a single party can be BOTH */
export type OutstandingPartyType = 'CUSTOMER' | 'SUPPLIER' | 'BOTH'

// ─── UI navigation types ─────────────────────────────────────────────────────

/** Tabs on the payment detail screen */
export type PaymentDetailTab = 'overview' | 'allocations' | 'history'

/** Pill tabs on the payment creation/edit form */
export type PaymentFormSection = 'details' | 'invoices' | 'discount'

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
  /** Entered value: 0–100 for PERCENTAGE, paise for FIXED */
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

// ─── Form Data ────────────────────────────────────────────────────────────────

/** One row in the "Link to Invoices" section of the payment form */
export interface PaymentFormAllocation {
  invoiceId: string
  invoiceNumber: string
  /** How much is still owed on this invoice, in PAISE */
  invoiceDue: number
  /** How much to allocate from this payment, in PAISE */
  amount: number
  /** Whether this invoice row is checked/selected */
  selected: boolean
}

/** Discount section of the payment form */
export interface PaymentFormDiscount {
  type: PaymentDiscountType
  /** 0–100 for PERCENTAGE, paise for FIXED */
  value: number
  /** Calculated amount in PAISE — derived by the hook, not user-entered */
  calculatedAmount: number
  reason: string
}

/** Full shape of the payment creation / edit form */
export interface PaymentFormData {
  type: PaymentType
  partyId: string
  /** Total amount being recorded, in PAISE */
  amount: number
  /** ISO date string "YYYY-MM-DD" */
  date: string
  mode: PaymentMode
  referenceNumber: string
  notes: string
  allocations: PaymentFormAllocation[]
  discount: PaymentFormDiscount | null
}

// ─── Outstanding ──────────────────────────────────────────────────────────────

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

// ─── Payment Reminders ───────────────────────────────────────────────────────

/** A single reminder record */
export interface PaymentReminder {
  id: string
  partyId: string
  partyName: string
  /** Null for general outstanding reminders (not invoice-specific) */
  invoiceId: string | null
  invoiceNumber: string | null
  channel: ReminderChannel
  status: ReminderStatus
  message: string
  sentAt: string | null
  failureReason: string | null
  /** true = triggered by the auto-remind scheduler; false = sent manually by user */
  isAutomatic: boolean
  createdAt: string
}

/** Business-level reminder configuration — mirrors GET /settings/reminders */
export interface ReminderConfig {
  enabled: boolean
  autoRemindEnabled: boolean
  /** Days after due date to trigger automatic reminders, e.g. [1, 3, 7] */
  frequencyDays: number[]
  maxRemindersPerInvoice: number
  defaultChannel: ReminderChannel
  /** 24h format "HH:MM" — no reminders sent before this time */
  quietHoursStart: string
  /** 24h format "HH:MM" — no reminders sent after this time */
  quietHoursEnd: string
  whatsappTemplate: string
  smsTemplate: string
}
