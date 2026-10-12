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
    tag,
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
  // CRM #127 — only forward the chip-bar tag when it's a non-empty string.
  if (tag !== undefined && tag !== '') params.set('tag', tag)

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
  return api<PartyListResponse>(`/parties${buildPartyQuery(filters)}`, {
    signal,
    cacheReads: true,
  })
}

import { PartyRepository } from '@/repositories/party.repository'

/**
 * Fetch full detail for a single party by ID.
 * Returns instantly from local Dexie store if present, falls back to server.
 */
export async function getParty(
  id: string,
  signal?: AbortSignal
): Promise<PartyDetail> {
  try {
    const repo = new PartyRepository()
    const local = await repo.getById(id)
    if (local) return local
  } catch {}
  const { party } = await api<{ party: PartyDetail }>(`/parties/${id}`, { signal })
  return party
}

/**
 * Create a new party.
 * Writes locally to Dexie in <1ms + enqueues to outbox, then background syncs.
 */
export async function createParty(
  data: PartyFormData,
  signal?: AbortSignal
): Promise<PartyDetail | null> {
  try {
    const repo = new PartyRepository()
    const local = await repo.create(data)
    // Background fire-and-forget server create
    void api<{ party: PartyDetail }>('/parties', {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
      entityType: 'party',
      entityLabel: data.name ?? 'New party',
    }).catch(() => {})
    return local
  } catch {
    const { party } = await api<{ party: PartyDetail }>('/parties', {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
      entityType: 'party',
      entityLabel: data.name ?? 'New party',
    })
    return party ?? null
  }
}

/**
 * Update an existing party. Accepts partial form data.
 * Updates locally in Dexie in <1ms + outbox enqueue, then background syncs.
 */
export async function updateParty(
  id: string,
  data: Partial<PartyFormData>,
  signal?: AbortSignal,
  expectedVersion?: number
): Promise<PartyDetail | null> {
  try {
    const repo = new PartyRepository()
    const local = await repo.update(id, data)
    void api<{ party: PartyDetail }>(`/parties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      signal,
      entityType: 'party',
      entityLabel: data.name ?? 'Party update',
      entityVersion: expectedVersion,
    }).catch(() => {})
    if (local) return local
  } catch {}

  const { party } = await api<{ party: PartyDetail }>(`/parties/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    signal,
    entityType: 'party',
    entityLabel: data.name ?? 'Party update',
    entityVersion: expectedVersion, // #150 optimistic lock
  })
  return party ?? null
}

/**
 * Delete a party. Soft delete locally in <1ms + outbox enqueue, then background syncs.
 */
export async function deleteParty(
  id: string,
  hard = false,
  signal?: AbortSignal
): Promise<void> {
  try {
    const repo = new PartyRepository()
    await repo.delete(id)
    void api<void>(`/parties/${id}${hard ? '?hard=true' : ''}`, {
      method: 'DELETE',
      signal,
      entityType: 'party',
      entityLabel: hard ? 'Delete party permanently' : 'Delete party',
    }).catch(() => {})
    return
  } catch {
    return api<void>(`/parties/${id}${hard ? '?hard=true' : ''}`, {
      method: 'DELETE',
      signal,
      entityType: 'party',
      entityLabel: hard ? 'Delete party permanently' : 'Delete party',
    })
  }
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
