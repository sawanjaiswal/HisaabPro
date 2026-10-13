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
 * Level 6 SSOT: Writes locally to Dexie in <1ms + enqueues to transactional outbox.
 * SyncManager background syncs to /api/sync/push without redundant parallel REST calls.
 */
export async function createParty(
  data: PartyFormData,
  _signal?: AbortSignal
): Promise<PartyDetail | null> {
  const repo = new PartyRepository()
  return repo.create(data)
}

/**
 * Update an existing party. Accepts partial form data.
 * Level 6 SSOT: Updates locally in Dexie in <1ms + enqueues to transactional outbox.
 */
export async function updateParty(
  id: string,
  data: Partial<PartyFormData>,
  _signal?: AbortSignal,
  _expectedVersion?: number
): Promise<PartyDetail | null> {
  const repo = new PartyRepository()
  return repo.update(id, data)
}

/**
 * Delete a party.
 * Level 6 SSOT: Soft deletes locally in Dexie in <1ms + enqueues to transactional outbox.
 */
export async function deleteParty(
  id: string,
  _hard = false,
  _signal?: AbortSignal
): Promise<void> {
  const repo = new PartyRepository()
  await repo.delete(id)
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
