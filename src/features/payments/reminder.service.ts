/** Payment Reminders — API service layer
 *
 * API base: the `api()` helper already prepends API_URL, so paths start at /
 * (not /api). The server routes are mounted at /payments/reminders.
 */

import { api } from '@/lib/api'
import type {
  PaymentReminder,
  ReminderConfig,
} from './payment.types'

// ─── Local request/response types ─────────────────────────────────────────────

export interface SendReminderRequest {
  partyId: string
  invoiceId?: string
  channel: 'WHATSAPP' | 'SMS' | 'PUSH'
  /** Optional — overrides the default template message */
  message?: string
}

export interface SendBulkRemindersRequest {
  partyIds: string[]
  channel: 'WHATSAPP' | 'SMS' | 'PUSH'
  message?: string
}

export interface SendBulkRemindersResponse {
  sent: number
  failed: number
  results: Array<{
    partyId: string
    partyName: string
    status: 'SENT' | 'FAILED'
    failureReason: string | null
  }>
}

export interface ReminderFilters {
  partyId?: string
  invoiceId?: string
  status?: 'SCHEDULED' | 'SENT' | 'FAILED' | 'ACKNOWLEDGED'
  channel?: 'WHATSAPP' | 'SMS' | 'PUSH'
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export interface ReminderListResponse {
  reminders: PaymentReminder[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ─── Query builder helper ─────────────────────────────────────────────────────

/**
 * Builds a query string from ReminderFilters.
 */
function buildReminderQuery(filters: ReminderFilters): string {
  const params = new URLSearchParams()

  const {
    partyId,
    invoiceId,
    status,
    channel,
    dateFrom,
    dateTo,
    page,
    limit,
  } = filters

  if (partyId !== undefined) params.set('partyId', partyId)
  if (invoiceId !== undefined) params.set('invoiceId', invoiceId)
  if (status !== undefined) params.set('status', status)
  if (channel !== undefined) params.set('channel', channel)
  if (dateFrom !== undefined) params.set('dateFrom', dateFrom)
  if (dateTo !== undefined) params.set('dateTo', dateTo)
  if (page !== undefined) params.set('page', String(page))
  if (limit !== undefined) params.set('limit', String(limit))

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// ─── Reminders ────────────────────────────────────────────────────────────────

/**
 * Send a manual payment reminder to a single party.
 * Pass invoiceId to send an invoice-specific reminder; omit for a general outstanding reminder.
 * WhatsApp opens via Capacitor share sheet on mobile; SMS uses Aisensy gateway.
 * Returns the created PaymentReminder record with send status.
 */
export async function sendReminder(
  data: SendReminderRequest
): Promise<PaymentReminder> {
  return api<PaymentReminder>('/payments/reminders/send', {
    method: 'POST',
    body: JSON.stringify(data),
    entityType: 'payment-reminder',
    entityLabel: `Send ${data.channel} reminder`,
  })
}

/**
 * Send reminders to multiple parties in a single request (max 50 partyIds).
 * Sent sequentially on the server — caller can poll results for progress.
 * Returns a summary: { sent, failed, results[] }.
 */
export async function sendBulkReminders(
  data: SendBulkRemindersRequest
): Promise<SendBulkRemindersResponse> {
  return api<SendBulkRemindersResponse>('/payments/reminders/send-bulk', {
    method: 'POST',
    body: JSON.stringify(data),
    entityType: 'payment-reminder',
    entityLabel: `Bulk reminder — ${data.partyIds.length} parties`,
  })
}

/**
 * Fetch reminder history with filters.
 * Supports filtering by party, invoice, status, channel, and date range.
 */
export async function getReminders(
  filters: ReminderFilters = {},
  signal?: AbortSignal
): Promise<ReminderListResponse> {
  return api<ReminderListResponse>(
    `/payments/reminders/list${buildReminderQuery(filters)}`,
    { signal }
  )
}

/**
 * Fetch the business-level reminder configuration.
 * Controls auto-remind scheduling, frequency, quiet hours, and message templates.
 */
export async function getReminderConfig(
  signal?: AbortSignal
): Promise<ReminderConfig> {
  return api<ReminderConfig>('/payments/reminders/config', { signal })
}

/**
 * Update the business-level reminder configuration.
 * Returns the updated ReminderConfig.
 */
export async function updateReminderConfig(
  data: Partial<ReminderConfig>
): Promise<ReminderConfig> {
  return api<ReminderConfig>('/payments/reminders/config', {
    method: 'PUT',
    body: JSON.stringify(data),
    entityType: 'reminder-config',
    entityLabel: 'Reminder settings',
  })
}
