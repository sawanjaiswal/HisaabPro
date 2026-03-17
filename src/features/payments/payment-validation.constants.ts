/** Payment Validation & Defaults — Limits, pagination, filters, reminder config
 *
 * Validation constraints, pagination defaults, filter initial states,
 * and default reminder configuration.
 */

import type {
  PaymentFilters,
  ReminderChannel,
  OutstandingFilters,
} from './payment.types'

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
