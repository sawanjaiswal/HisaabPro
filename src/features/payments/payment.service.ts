/** Payment Tracking — API service layer
 *
 * All monetary values are in PAISE (integer) — the server and client both
 * use paise. Display conversion is done at the component level via formatCurrency.
 *
 * API base: the `api()` helper already prepends API_URL, so paths start at /
 * (not /api). The server routes are mounted at /payments, /outstanding,
 * and /reminders.
 */

import { api } from '@/lib/api'
import type {
  PaymentListResponse,
  PaymentDetail,
  PaymentFormData,
  PaymentDeleteResponse,
  PaymentFilters,
  OutstandingListResponse,
  OutstandingPartyDetail,
  OutstandingFilters,
  PaymentReminder,
  ReminderConfig,
  PaymentAllocation,
} from './payment.types'

// ─── Local request-body types ─────────────────────────────────────────────────

export interface AllocationInput {
  invoiceId: string
  amount: number  // paise
}

export interface UpdateAllocationsRequest {
  allocations: AllocationInput[]
}

export interface UpdateAllocationsResponse {
  paymentId: string
  allocations: PaymentAllocation[]
  unallocatedAmount: number
  updatedInvoices: Array<{
    invoiceId: string
    invoiceNumber: string
    newDue: number
    newStatus: string
  }>
}

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

// ─── Query builder helpers ────────────────────────────────────────────────────

/**
 * Builds a URLSearchParams query string from PaymentFilters.
 * Only appends params that have non-undefined, non-empty values.
 */
function buildPaymentQuery(filters: Partial<PaymentFilters>): string {
  const params = new URLSearchParams()

  const {
    page,
    limit,
    type,
    partyId,
    mode,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
    search,
  } = filters

  if (page !== undefined) params.set('page', String(page))
  if (limit !== undefined) params.set('limit', String(limit))
  if (type !== undefined) params.set('type', type)
  if (partyId !== undefined) params.set('partyId', partyId)
  if (mode !== undefined) params.set('mode', mode)
  if (dateFrom !== undefined) params.set('dateFrom', dateFrom)
  if (dateTo !== undefined) params.set('dateTo', dateTo)
  if (sortBy !== undefined) params.set('sortBy', sortBy)
  if (sortOrder !== undefined) params.set('sortOrder', sortOrder)
  if (search !== undefined && search !== '') params.set('search', search)

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Builds a query string from OutstandingFilters.
 * Only appends params that have non-undefined, non-empty values.
 */
function buildOutstandingQuery(filters: Partial<OutstandingFilters>): string {
  const params = new URLSearchParams()

  const {
    type,
    overdue,
    sortBy,
    sortOrder,
    search,
    page,
    limit,
  } = filters

  if (type !== undefined) params.set('type', type)
  if (overdue !== undefined) params.set('overdue', String(overdue))
  if (sortBy !== undefined) params.set('sortBy', sortBy)
  if (sortOrder !== undefined) params.set('sortOrder', sortOrder)
  if (search !== undefined && search !== '') params.set('search', search)
  if (page !== undefined) params.set('page', String(page))
  if (limit !== undefined) params.set('limit', String(limit))

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

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

// ─── Payments CRUD ────────────────────────────────────────────────────────────

/**
 * Fetch paginated payment list.
 * Supports filtering by type, party, mode, date range, search, and sort.
 * Response includes a summary of total in/out/net (all in paise).
 */
export async function getPayments(
  filters: Partial<PaymentFilters> = {},
  signal?: AbortSignal
): Promise<PaymentListResponse> {
  return api<PaymentListResponse>(
    `/payments${buildPaymentQuery(filters)}`,
    { signal }
  )
}

/**
 * Fetch full detail for a single payment by ID.
 * Includes allocations, discount, and party outstanding snapshot.
 */
export async function getPayment(
  id: string,
  signal?: AbortSignal
): Promise<PaymentDetail> {
  return api<PaymentDetail>(`/payments/${id}`, { signal })
}

/**
 * Record a new payment (Payment In or Payment Out).
 *
 * Pass allocations to link to invoices at creation time (FIFO auto-allocation
 * can be done client-side via autoAllocateFIFO() before calling this).
 * Pass discount to apply a settlement discount.
 * Pass offlineId (client-generated UUID) for idempotent offline sync.
 *
 * Returns the full PaymentDetail (201 Created).
 */
export async function createPayment(
  data: PaymentFormData
): Promise<PaymentDetail> {
  return api<PaymentDetail>('/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Update an existing payment.
 * Recalculates all linked invoice balances and party outstanding atomically.
 * Returns 400 PAYMENT_LOCKED if the payment is older than the business lock period.
 * Returns the updated PaymentDetail (200 OK).
 */
export async function updatePayment(
  id: string,
  data: Partial<PaymentFormData>
): Promise<PaymentDetail> {
  return api<PaymentDetail>(`/payments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/**
 * Soft-delete a payment → moves it to the recycle bin (30 days).
 * Side effects: linked invoice balances reversed, party outstanding re-calculated.
 * Returns a slim { id, deletedAt, message } response.
 */
export async function deletePayment(
  id: string
): Promise<PaymentDeleteResponse> {
  return api<PaymentDeleteResponse>(`/payments/${id}`, {
    method: 'DELETE',
  })
}

/**
 * Restore a soft-deleted payment from the recycle bin.
 * Side effects: linked invoice balances re-applied, party outstanding re-calculated.
 * Returns the restored PaymentDetail.
 */
export async function restorePayment(id: string): Promise<PaymentDetail> {
  return api<PaymentDetail>(`/payments/${id}/restore`, {
    method: 'POST',
  })
}

// ─── Payment Allocations ──────────────────────────────────────────────────────

/**
 * Update invoice allocations for an existing payment.
 * Replaces the full allocation set — send all desired allocations, not a delta.
 * Any unallocated amount becomes advance balance.
 * Returns updated allocations, unallocated amount, and affected invoice statuses.
 */
export async function updateAllocations(
  paymentId: string,
  allocations: AllocationInput[]
): Promise<UpdateAllocationsResponse> {
  return api<UpdateAllocationsResponse>(
    `/payments/${paymentId}/allocations`,
    {
      method: 'PUT',
      body: JSON.stringify({ allocations } satisfies UpdateAllocationsRequest),
    }
  )
}

// ─── Outstanding ──────────────────────────────────────────────────────────────

/**
 * Fetch outstanding summary for all parties.
 * Returns per-party outstanding with aging buckets (current, 1-30, 31-60, 61-90, 90+).
 * Also returns aggregate totals: totalReceivable, totalPayable, net, overdue amounts.
 */
export async function getOutstanding(
  filters: Partial<OutstandingFilters> = {},
  signal?: AbortSignal
): Promise<OutstandingListResponse> {
  return api<OutstandingListResponse>(
    `/payments/outstanding/list${buildOutstandingQuery(filters)}`,
    { signal }
  )
}

/**
 * Fetch detailed outstanding for a single party.
 * Includes all unpaid/partially-paid invoices with individual payment histories,
 * aging breakdown, and advance balance.
 */
export async function getPartyOutstanding(
  partyId: string,
  signal?: AbortSignal
): Promise<OutstandingPartyDetail> {
  return api<OutstandingPartyDetail>(`/payments/outstanding/${partyId}`, { signal })
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
  })
}
