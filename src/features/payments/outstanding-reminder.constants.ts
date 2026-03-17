/** Outstanding & Reminder — Labels, badges, and status maps
 *
 * Display labels and badge classes for outstanding balances and payment reminders.
 */

import type {
  OutstandingType,
  OutstandingSortBy,
  ReminderChannel,
  ReminderStatus,
} from './payment.types'

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
