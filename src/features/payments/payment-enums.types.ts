/** Payment Tracking — Enum / union type definitions
 *
 * Re-exports from @shared/enums (SSOT). Feature-specific UI types stay here.
 */

// ─── Re-exports from SSOT ───────────────────────────────────────────────────

export type {
  PaymentType,
  PaymentMode,
  PaymentDiscountType,
  PaymentSortBy,
  PaymentRecordStatus,
  SyncStatus,
  ReminderStatus,
  ReminderChannel,
  OutstandingType,
  OutstandingSortBy,
} from '@shared/enums'

export {
  PAYMENT_TYPES,
  PAYMENT_MODES,
  PAYMENT_DISCOUNT_TYPES,
  PAYMENT_SORT_BY,
  PAYMENT_RECORD_STATUSES,
  SYNC_STATUSES,
  REMINDER_STATUSES,
  REMINDER_CHANNELS,
  OUTSTANDING_TYPES,
  OUTSTANDING_SORT_BY,
} from '@shared/enums'

// ─── Feature-specific UI types (not shared with backend) ────────────────────

/** Party role in the context of outstanding — a single party can be BOTH */
export type OutstandingPartyType = 'CUSTOMER' | 'SUPPLIER' | 'BOTH'

/** Tabs on the payment detail screen */
export type PaymentDetailTab = 'overview' | 'allocations' | 'history'

/** Pill tabs on the payment creation/edit form */
export type PaymentFormSection = 'details' | 'invoices' | 'discount'
