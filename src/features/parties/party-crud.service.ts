/** Party CRUD & Transaction Ledger — API service layer */

import { api } from '@/lib/api'
import type {
  PartyListResponse,
  PartyDetail,
  PartyFilters,
  PartyFormData,
  PartyTransactionListResponse,
} from './party.types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a query string from PartyFilters, omitting undefined/null values
 * and the 'ALL' type sentinel (backend expects no `type` param when all).
 */
export function buildPartyQuery(filters: Partial<PartyFilters>): string {
  const params = new URLSearchParams()

  const {
    page,
    limit,
    search,
    type,
    groupId,
    hasOutstanding,
    isActive,
    sortBy,
    sortOrder,
  } = filters

  if (page !== undefined) params.set('page', String(page))
  if (limit !== undefined) params.set('limit', String(limit))
  if (search !== undefined && search !== '') params.set('search', search)
  if (type !== undefined && type !== 'ALL') params.set('type', type)
  if (groupId !== undefined) params.set('groupId', groupId)
  if (hasOutstanding !== undefined) params.set('hasOutstanding', String(hasOutstanding))
  if (isActive !== undefined) params.set('isActive', String(isActive))
  if (sortBy !== undefined) params.set('sortBy', sortBy)
  if (sortOrder !== undefined) params.set('sortOrder', sortOrder)

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// ─── Party CRUD ───────────────────────────────────────────────────────────────

/**
 * Fetch paginated party list with optional filters.
 * Returns parties, pagination meta, and outstanding summary.
 */
export async function getParties(
  filters: Partial<PartyFilters> = {},
  signal?: AbortSignal
): Promise<PartyListResponse> {
  return api<PartyListResponse>(`/parties${buildPartyQuery(filters)}`, { signal })
}

/**
 * Fetch full detail for a single party by ID.
 */
export async function getParty(
  id: string,
  signal?: AbortSignal
): Promise<PartyDetail> {
  return api<PartyDetail>(`/parties/${id}`, { signal })
}

/**
 * Create a new party. Returns the full party detail.
 */
export async function createParty(
  data: PartyFormData,
  signal?: AbortSignal
): Promise<PartyDetail> {
  return api<PartyDetail>('/parties', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Update an existing party. Accepts partial form data.
 * Returns the updated party detail.
 */
export async function updateParty(
  id: string,
  data: Partial<PartyFormData>,
  signal?: AbortSignal
): Promise<PartyDetail> {
  return api<PartyDetail>(`/parties/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Delete a party. Soft delete by default; pass hard=true for permanent.
 */
export async function deleteParty(
  id: string,
  hard = false,
  signal?: AbortSignal
): Promise<void> {
  return api<void>(`/parties/${id}${hard ? '?hard=true' : ''}`, {
    method: 'DELETE',
    signal,
  })
}

// ─── Party Transaction Ledger ─────────────────────────────────────────────────

/**
 * Fetch combined invoice + payment ledger for a party, sorted by date.
 * Returns transactions with running balance, pagination, and summary totals.
 */
export async function getPartyTransactions(
  partyId: string,
  filters: { page?: number; limit?: number; fromDate?: string; toDate?: string } = {},
  signal?: AbortSignal
): Promise<PartyTransactionListResponse> {
  const params = new URLSearchParams()
  if (filters.page !== undefined) params.set('page', String(filters.page))
  if (filters.limit !== undefined) params.set('limit', String(filters.limit))
  if (filters.fromDate) params.set('fromDate', filters.fromDate)
  if (filters.toDate) params.set('toDate', filters.toDate)
  const qs = params.toString()
  return api<PartyTransactionListResponse>(
    `/parties/${partyId}/transactions${qs ? `?${qs}` : ''}`,
    { signal }
  )
}
