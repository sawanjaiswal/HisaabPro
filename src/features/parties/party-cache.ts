/**
 * Party cache reconciliation — SSOT.
 *
 * Every party mutation (create/update/delete) MUST route its React Query cache
 * update through one of these functions. Previously each call site (the form
 * hook, the list hook, the detail page, bulk import) reconciled the cache
 * differently — or forgot to — so a created/edited party would show a success
 * toast but not appear in the list until a hard reload (global staleTime is
 * 30s, so the cached list stayed "fresh").
 *
 * Pattern: optimistically patch every cached `['parties', ...]` list for an
 * INSTANT UI update, then invalidate so the server reconciles ordering/totals
 * in the background. Do NOT call `invalidateQueries({ queryKey:
 * queryKeys.parties.* })` directly from feature code — use these instead.
 */
import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import type { PartyDetail, PartyListResponse } from './party.types'

/** Type guard — a cached `['parties', ...]` entry that is a paginated list. */
function isPartyList(value: unknown): value is PartyListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as PartyListResponse).parties)
  )
}

/**
 * Instant-insert a newly created party into every cached list, then invalidate.
 * `created` (a `PartyDetail`) extends `PartySummary`, so it drops straight into
 * the list. Prepending to filtered lists that don't match is corrected by the
 * follow-up invalidation when that filter is next viewed.
 */
export function reconcilePartyCreated(qc: QueryClient, created: PartyDetail): void {
  qc.setQueriesData<PartyListResponse>(
    { queryKey: queryKeys.parties.all() },
    (old) => {
      if (!isPartyList(old)) return old
      if (old.parties.some((p) => p.id === created.id)) return old
      return {
        ...old,
        parties: [created, ...old.parties],
        pagination: { ...old.pagination, total: old.pagination.total + 1 },
      }
    },
  )
  qc.invalidateQueries({ queryKey: queryKeys.parties.all() })
}

/**
 * Patch an updated party into every cached list + its detail cache, then
 * invalidate. Keeps the list row and the open detail view in sync instantly.
 */
export function reconcilePartyUpdated(qc: QueryClient, updated: PartyDetail): void {
  qc.setQueriesData<PartyListResponse>(
    { queryKey: queryKeys.parties.all() },
    (old) => {
      if (!isPartyList(old)) return old
      return {
        ...old,
        parties: old.parties.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
      }
    },
  )
  qc.setQueryData(queryKeys.parties.detail(updated.id), updated)
  qc.invalidateQueries({ queryKey: queryKeys.parties.all() })
}

/**
 * Optimistically remove a party from every cached list WITHOUT invalidating.
 * Use for the deferred-delete (5s undo) flow: the server delete hasn't happened
 * yet, so refetching now would re-add the row. Reconcile later via
 * `invalidatePartyLists` (on undo / error / after the real delete lands).
 */
export function optimisticRemoveParty(qc: QueryClient, id: string): void {
  qc.setQueriesData<PartyListResponse>(
    { queryKey: queryKeys.parties.all() },
    (old) => {
      if (!isPartyList(old)) return old
      if (!old.parties.some((p) => p.id === id)) return old
      return {
        ...old,
        parties: old.parties.filter((p) => p.id !== id),
        pagination: { ...old.pagination, total: Math.max(0, old.pagination.total - 1) },
      }
    },
  )
}

/**
 * Remove a party from every cached list, then invalidate. Use ONLY after the
 * server delete has actually completed (e.g. the awaited delete on the detail
 * page) — invalidating before the server has deleted would refetch the row back.
 */
export function reconcilePartyDeleted(qc: QueryClient, id: string): void {
  optimisticRemoveParty(qc, id)
  qc.invalidateQueries({ queryKey: queryKeys.parties.all() })
}

/**
 * Invalidate every cached party list — for bulk operations (import) where
 * per-row optimistic insert is not worthwhile. Refetch pulls the true set.
 */
export function invalidatePartyLists(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: queryKeys.parties.all() })
}
