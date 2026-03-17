/** Payment Tracking — Reminder types
 *
 * Data shapes for payment reminders (WhatsApp, SMS, Push).
 */

import type { ReminderChannel, ReminderStatus } from './payment-enums.types'

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
