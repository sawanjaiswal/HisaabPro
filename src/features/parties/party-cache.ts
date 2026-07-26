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
import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import type { PartyDetail, PartyListResponse } from './party.types'

/**
 * A cached `['parties', ...]` list is one of two shapes: a single response
 * (detail-page sidebars, pickers) or the accumulated pages of the main list's
 * `useInfiniteQuery`. Every helper below goes through `updatePartyLists` so a
 * new call site cannot silently handle one shape and skip the other — the bug
 * that shape blindness produces is a success toast with an unchanged list.
 */
type PartyListCache = PartyListResponse | InfiniteData<PartyListResponse>

/** Type guard — a cached `['parties', ...]` entry that is a paginated list. */
function isPartyList(value: unknown): value is PartyListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as PartyListResponse).parties)
  )
}

/** Type guard — the `{ pages, pageParams }` envelope of an infinite list. */
function isInfinitePartyList(value: unknown): value is InfiniteData<PartyListResponse> {
  const pages = (value as InfiniteData<PartyListResponse> | null)?.pages
  return Array.isArray(pages) && pages.every(isPartyList)
}

/**
 * Applies `transform` to every cached party list page, in either shape.
 * `index` is the page's position, so a transform can distinguish "prepend to
 * the first page" from "this page only needs its total adjusted".
 */
function updatePartyLists(
  qc: QueryClient,
  transform: (page: PartyListResponse, index: number) => PartyListResponse,
): void {
  qc.setQueriesData<PartyListCache>({ queryKey: queryKeys.parties.all() }, (old) => {
    if (isInfinitePartyList(old)) return { ...old, pages: old.pages.map(transform) }
    if (isPartyList(old)) return transform(old, 0)
    return old
  })
}

/** Shifts a page's `total` without letting it go negative. */
function withTotalDelta(page: PartyListResponse, delta: number): PartyListResponse {
  return {
    ...page,
    pagination: { ...page.pagination, total: Math.max(0, page.pagination.total + delta) },
  }
}

/**
 * Instant-insert a newly created party into every cached list, then invalidate.
 * `created` (a `PartyDetail`) extends `PartySummary`, so it drops straight into
 * the list. Prepending to filtered lists that don't match is corrected by the
 * follow-up invalidation when that filter is next viewed.
 */
export function reconcilePartyCreated(qc: QueryClient, created: PartyDetail): void {
  updatePartyLists(qc, (page, index) => {
    if (page.parties.some((p) => p.id === created.id)) return page
    // The row goes on page 1 only — putting it on every loaded page would show
    // the same party three times. Later pages still carry the bumped total so
    // the summary card and the "has more" check stay consistent.
    const bumped = withTotalDelta(page, 1)
    return index === 0 ? { ...bumped, parties: [created, ...bumped.parties] } : bumped
  })
  qc.invalidateQueries({ queryKey: queryKeys.parties.all() })
}

/**
 * Patch an updated party into every cached list + its detail cache, then
 * invalidate. Keeps the list row and the open detail view in sync instantly.
 */
export function reconcilePartyUpdated(qc: QueryClient, updated: PartyDetail): void {
  updatePartyLists(qc, (page) => ({
    ...page,
    parties: page.parties.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
  }))
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
  updatePartyLists(qc, (page) => {
    // Decrement on the page that actually held the row, so a party removed
    // from page 2 doesn't take the total down once per loaded page.
    if (!page.parties.some((p) => p.id === id)) return page
    return withTotalDelta({ ...page, parties: page.parties.filter((p) => p.id !== id) }, -1)
  })
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
