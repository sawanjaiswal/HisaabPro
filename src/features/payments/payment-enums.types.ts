/** Payment Tracking — Enum / union type definitions
 *
 * All union-type literals used across payment, outstanding, and reminder features.
 */

// ─── Payment enums ────────────────────────────────────────────────────────────

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

/** Reminder lifecycle state (see PRD section 3 state machine) */
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
