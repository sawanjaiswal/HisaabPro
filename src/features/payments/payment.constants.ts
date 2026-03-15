/** Payment Tracking — Constants and configuration
 *
 * All label maps, defaults, and config values for the payment tracking system.
 * No business logic here — pure data.
 */

import type {
  PaymentType,
  PaymentMode,
  PaymentDiscountType,
  PaymentSortBy,
  PaymentFilters,
  ReminderChannel,
  ReminderStatus,
  OutstandingType,
  OutstandingSortBy,
  OutstandingFilters,
  PaymentFormSection,
  PaymentDetailTab,
} from './payment.types'

// ─── Payment type labels ──────────────────────────────────────────────────────

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  PAYMENT_IN:  'Payment In',
  PAYMENT_OUT: 'Payment Out',
}

// ─── Payment type badge CSS class variants ────────────────────────────────────
// CSS classes defined in the design system. No raw colors here.

export const PAYMENT_TYPE_BADGE: Record<PaymentType, string> = {
  PAYMENT_IN:  'badge-paid',
  PAYMENT_OUT: 'badge-overdue',
}

// ─── Payment mode labels ──────────────────────────────────────────────────────

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH:           'Cash',
  UPI:            'UPI',
  BANK_TRANSFER:  'Bank Transfer',
  CHEQUE:         'Cheque',
  NEFT_RTGS_IMPS: 'NEFT/RTGS/IMPS',
  CREDIT_CARD:    'Credit Card',
  OTHER:          'Other',
}

// ─── Payment mode icon names (lucide) ────────────────────────────────────────
// Referenced by icon components via name — no direct imports here.

export const PAYMENT_MODE_ICONS: Record<PaymentMode, string> = {
  CASH:           'banknote',
  UPI:            'smartphone',
  BANK_TRANSFER:  'building-2',
  CHEQUE:         'file-text',
  NEFT_RTGS_IMPS: 'arrow-right-left',
  CREDIT_CARD:    'credit-card',
  OTHER:          'circle-dot',
}

// ─── Reference number placeholder per mode ───────────────────────────────────
// Shown as the input placeholder in the "Reference Number" field.

export const REFERENCE_PLACEHOLDERS: Record<PaymentMode, string> = {
  CASH:           'Receipt Number',
  UPI:            'UPI Transaction ID',
  BANK_TRANSFER:  'Transaction Reference',
  CHEQUE:         'Cheque Number',
  NEFT_RTGS_IMPS: 'UTR Number',
  CREDIT_CARD:    'Approval Code',
  OTHER:          'Reference',
}

// ─── Modes that require a reference number ───────────────────────────────────
// CASH is excluded — reference is optional and hidden by default for cash.

export const MODES_WITH_REFERENCE: PaymentMode[] = [
  'UPI',
  'BANK_TRANSFER',
  'CHEQUE',
  'NEFT_RTGS_IMPS',
  'CREDIT_CARD',
  'OTHER',
]

// ─── Discount type labels ─────────────────────────────────────────────────────

export const PAYMENT_DISCOUNT_TYPE_LABELS: Record<PaymentDiscountType, string> = {
  PERCENTAGE: 'Percentage (%)',
  FIXED:      'Fixed Amount (₹)',
}

// ─── Sort option labels ───────────────────────────────────────────────────────

export const PAYMENT_SORT_LABELS: Record<PaymentSortBy, string> = {
  date:      'Date',
  amount:    'Amount',
  createdAt: 'Created',
}

// ─── Outstanding type labels ──────────────────────────────────────────────────

export const OUTSTANDING_TYPE_LABELS: Record<OutstandingType, string> = {
  ALL:        'All',
  RECEIVABLE: 'Receivable',
  PAYABLE:    'Payable',
}

// ─── Outstanding sort labels ──────────────────────────────────────────────────

export const OUTSTANDING_SORT_LABELS: Record<OutstandingSortBy, string> = {
  amount:      'Amount',
  name:        'Name',
  daysOverdue: 'Days Overdue',
}

// ─── Reminder channel labels ──────────────────────────────────────────────────

export const REMINDER_CHANNEL_LABELS: Record<ReminderChannel, string> = {
  WHATSAPP: 'WhatsApp',
  SMS:      'SMS',
  PUSH:     'Push Notification',
}

// ─── Reminder status labels ───────────────────────────────────────────────────

export const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> = {
  SCHEDULED:          'Scheduled',
  SENDING:            'Sending',
  SENT:               'Sent',
  FAILED:             'Failed',
  PERMANENTLY_FAILED: 'Permanently Failed',
  ACKNOWLEDGED:       'Acknowledged',
}

// ─── Reminder status badge CSS class variants ─────────────────────────────────

export const REMINDER_STATUS_BADGE: Record<ReminderStatus, string> = {
  SCHEDULED:          'badge-info',
  SENDING:            'badge-pending',
  SENT:               'badge-paid',
  FAILED:             'badge-error',
  PERMANENTLY_FAILED: 'badge-error',
  ACKNOWLEDGED:       'badge-converted',
}

// ─── Form section labels (pill tabs) ─────────────────────────────────────────

export const PAYMENT_FORM_SECTION_LABELS: Record<PaymentFormSection, string> = {
  details:  'Details',
  invoices: 'Link Invoices',
  discount: 'Discount',
}

// ─── Detail tab labels ────────────────────────────────────────────────────────

export const PAYMENT_DETAIL_TAB_LABELS: Record<PaymentDetailTab, string> = {
  overview:    'Overview',
  allocations: 'Allocations',
  history:     'History',
}

// ─── Aging bucket labels ──────────────────────────────────────────────────────

export const AGING_BUCKET_LABELS = {
  current:    'Current',
  days1to30:  '1–30 Days',
  days31to60: '31–60 Days',
  days61to90: '61–90 Days',
  days90plus: '90+ Days',
} as const

// ─── Aging bucket CSS variable references ────────────────────────────────────
// Defined as CSS variable strings so components never use raw hex.

export const AGING_BUCKET_COLORS = {
  current:    'var(--color-success)',
  days1to30:  'var(--color-warning-light)',
  days31to60: 'var(--color-warning)',
  days61to90: 'var(--color-error-light)',
  days90plus: 'var(--color-error)',
} as const

// ─── Validation constraints (from PRD §5 API contract) ───────────────────────

/** Max payment in PAISE: Rs 99,99,99,999 */
export const MAX_PAYMENT_AMOUNT = 9_999_999_900
/** Min payment in PAISE: Rs 0.01 */
export const MIN_PAYMENT_AMOUNT = 1
/** Max allocations a single payment can link to */
export const MAX_ALLOCATIONS_PER_PAYMENT = 50
/** Max parties selectable in a bulk reminder action */
export const MAX_BULK_REMINDERS = 50
/** Max auto-retries before a reminder is PERMANENTLY_FAILED */
export const MAX_REMINDER_RETRIES = 2
/** Max length of referenceNumber field */
export const MAX_REFERENCE_LENGTH = 100
/** Max length of notes field */
export const MAX_NOTES_LENGTH = 500
/** Max length of discount reason */
export const MAX_DISCOUNT_REASON_LENGTH = 200
/** Max length of reminder template message */
export const MAX_REMINDER_TEMPLATE_LENGTH = 1000

// ─── Pagination defaults ──────────────────────────────────────────────────────

export const PAYMENT_LIST_DEFAULT_LIMIT = 20
export const PAYMENT_LIST_MAX_LIMIT = 100
/** Days a soft-deleted payment is retained before permanent deletion */
export const RECYCLE_BIN_RETENTION_DAYS = 30

// ─── Default filter state ─────────────────────────────────────────────────────
// Omit `type` when spreading into a full PaymentFilters — each screen supplies its own.

export const DEFAULT_PAYMENT_FILTERS: Omit<PaymentFilters, 'type'> = {
  page:      1,
  limit:     PAYMENT_LIST_DEFAULT_LIMIT,
  sortBy:    'date',
  sortOrder: 'desc',
  search:    '',
}

export const DEFAULT_OUTSTANDING_FILTERS: OutstandingFilters = {
  type:      'ALL',
  overdue:   false,
  sortBy:    'amount',
  sortOrder: 'desc',
  search:    '',
  page:      1,
  limit:     PAYMENT_LIST_DEFAULT_LIMIT,
}

// ─── Default reminder config ──────────────────────────────────────────────────
// Applied when a business has not yet configured their reminder settings.

export const DEFAULT_REMINDER_CONFIG = {
  enabled:                  true,
  autoRemindEnabled:        false,
  frequencyDays:            [1, 3, 7],
  maxRemindersPerInvoice:   5,
  defaultChannel:           'WHATSAPP' as ReminderChannel,
  quietHoursStart:          '21:00',
  quietHoursEnd:            '09:00',
  whatsappTemplate:         'Namaskar {party_name},\n\nThis is a friendly reminder regarding your outstanding balance of ₹{amount} with {business_name}.\n\nPlease arrange payment at your earliest convenience.\n\nThank you,\n{business_name}\n{business_phone}',
  smsTemplate:              'Hi {party_name}, your outstanding with {business_name} is ₹{amount}. Please arrange payment. - {business_name}',
} as const

// ─── Reminder template variables ─────────────────────────────────────────────
// Shown as quick-insert chips in the template editor.

export const REMINDER_TEMPLATE_VARIABLES = [
  '{party_name}',
  '{amount}',
  '{invoice_no}',
  '{due_date}',
  '{business_name}',
  '{business_phone}',
  '{days_overdue}',
] as const
