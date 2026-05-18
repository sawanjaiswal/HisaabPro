/** Settings — Audit log hook (Phase 6 PR4 — cursor pagination + debounced q)
 *
 * Owns the filter state for /settings/audit. Debounces the freeform `q`
 * input so we don't issue a request on every keystroke; cursor-paginates the
 * results so the user explicitly opts into more rows (the audit log is
 * sensitive — no accidental over-fetch).
 *
 * Server-side PIN gate is transparent: PR3's `api()` interceptor opens
 * <PinPadSheet /> on 403 PIN_REQUIRED, verifies, then retries — the hook
 * just awaits the resolved promise.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'
import { queryKeys } from '@/lib/query-keys'
import { searchAuditLog } from './audit-log.service'
import { AUDIT_PAGE_SIZE, AUDIT_SEARCH_DEBOUNCE_MS } from './audit.constants'
import type { AuditSearchFilters, AuditSearchRow } from './audit.types'

type Status = 'loading' | 'error' | 'success'

interface UseAuditLogReturn {
  /** Flat array of rows across all loaded pages (cursor accumulator) */
  rows: AuditSearchRow[]
  status: Status
  /** Filter state — `q` here is the live (un-debounced) input value */
  filters: AuditSearchFilters
  setFilter: <K extends keyof AuditSearchFilters>(key: K, value: AuditSearchFilters[K]) => void
  setFilters: (next: AuditSearchFilters) => void
  clearFilters: () => void
  /** `true` while the in-flight page is one of the cursor follow-ups, not the first page */
  isFetchingMore: boolean
  /** Show a "Load more" CTA — false when the server returned nextCursor: null */
  hasMore: boolean
  loadMore: () => void
  refresh: () => void
}

const EMPTY_FILTERS: AuditSearchFilters = {}

export function useAuditLog(): UseAuditLogReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  // Live filter state — `q` updates per keystroke; `debouncedQ` is what we send
  const [filters, setFiltersState] = useState<AuditSearchFilters>(EMPTY_FILTERS)
  const debouncedQ = useDebounce(filters.q ?? '', AUDIT_SEARCH_DEBOUNCE_MS)

  // Effective filters sent to the BE — `q` swapped for its debounced value
  const effectiveFilters = useMemo<AuditSearchFilters>(
    () => ({ ...filters, q: debouncedQ || undefined }),
    [filters, debouncedQ],
  )

  // Stable key for the query cache. Stringify intentional — small object,
  // stable order, and React Query needs reference identity to dedupe.
  const queryKey = useMemo(
    () => queryKeys.settings.auditLog(effectiveFilters as Record<string, unknown>),
    [effectiveFilters],
  )

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      searchAuditLog(effectiveFilters, pageParam ?? null, AUDIT_PAGE_SIZE, signal),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  const rows = useMemo<AuditSearchRow[]>(
    () => query.data?.pages.flatMap((page) => page.rows) ?? [],
    [query.data],
  )

  // Toast on error — but only once per error reference. React Query keeps the
  // error stable across renders, so deduplication is by identity.
  const lastErrorRef = useRef<unknown>(null)
  useEffect(() => {
    if (!query.error) {
      lastErrorRef.current = null
      return
    }
    if (lastErrorRef.current === query.error) return
    lastErrorRef.current = query.error
    const message = query.error instanceof ApiError
      ? query.error.message
      : 'Failed to load audit log'
    toast.error(message)
  }, [query.error, toast])

  const status: Status = (() => {
    if (query.isPending) return 'loading'
    if (query.isError) return 'error'
    return 'success'
  })()

  const setFilter = useCallback(<K extends keyof AuditSearchFilters>(
    key: K,
    value: AuditSearchFilters[K],
  ) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }))
  }, [])

  const setFilters = useCallback((next: AuditSearchFilters) => {
    setFiltersState(next)
  }, [])

  const clearFilters = useCallback(() => {
    setFiltersState(EMPTY_FILTERS)
  }, [])

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage()
    }
  }, [query])

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.all() })
  }, [queryClient])

  return {
    rows,
    status,
    filters,
    setFilter,
    setFilters,
    clearFilters,
    isFetchingMore: query.isFetchingNextPage,
    hasMore: query.hasNextPage ?? false,
    loadMore,
    refresh,
  }
}
