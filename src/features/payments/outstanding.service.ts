/** Outstanding Balances — API service layer
 *
 * All monetary values are in PAISE (integer) — the server and client both
 * use paise. Display conversion is done at the component level via formatCurrency.
 *
 * API base: the `api()` helper already prepends API_URL, so paths start at /
 * (not /api). The server routes are mounted at /payments/outstanding.
 */

import { api } from '@/lib/api'
import type {
  OutstandingListResponse,
  OutstandingPartyDetail,
  OutstandingFilters,
} from './payment.types'

// ─── Query builder helper ─────────────────────────────────────────────────────

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
