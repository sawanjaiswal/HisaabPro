/** Payment CRUD & Allocations — API service layer
 *
 * All monetary values are in PAISE (integer) — the server and client both
 * use paise. Display conversion is done at the component level via formatCurrency.
 *
 * API base: the `api()` helper already prepends API_URL, so paths start at /
 * (not /api). The server routes are mounted at /payments.
 */

import { api } from '@/lib/api'
import type {
  PaymentListResponse,
  PaymentDetail,
  PaymentFormData,
  PaymentDeleteResponse,
  PaymentFilters,
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

// ─── Query builder helper ─────────────────────────────────────────────────────

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
