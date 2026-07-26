import { useState, useEffect, useCallback, useMemo } from 'react'
import { useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { TIMEOUTS } from '@/config/app.config'
import { DEFAULT_FILTERS } from './party.constants'
import { getParties, createParty, deleteParty } from './party.service'
import { reconcilePartyCreated, optimisticRemoveParty, invalidatePartyLists } from './party-cache'
import { queuedSuffix } from '@/lib/offline.feedback'
import type { PartyListResponse, PartyFilters, PartyFormData } from './party.types'

type Status = 'loading' | 'error' | 'success'

interface UsePartiesOptions {
  initialFilters?: Partial<PartyFilters>
}

interface UsePartiesReturn {
  data: PartyListResponse | null
  status: Status
  filters: PartyFilters
  setSearch: (term: string) => void
  setFilter: <K extends keyof PartyFilters>(key: K, value: PartyFilters[K]) => void
  /** True while the server reports pages the user has not loaded yet. */
  hasMore: boolean
  /** Appends the next page to `data.parties`. No-op when `hasMore` is false. */
  loadMore: () => void
  isLoadingMore: boolean
  refresh: () => void
  handleCreate: (formData: PartyFormData) => Promise<void>
  handleDelete: (id: string, name: string) => void
}

export function useParties({ initialFilters }: UsePartiesOptions = {}): UsePartiesReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState<PartyFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  })

  // Paged, not single-shot: a business with more parties than `limit` must be
  // able to reach the rest. `useInfiniteQuery` accumulates pages so "load more"
  // grows the list; a `useQuery` keyed on `filters.page` would swap rows 1-20
  // for 21-40 instead. Same idiom as the other paged lists in the app
  // (src/features/custom-orders/hooks/useCustomOrders.ts).
  const query = useInfiniteQuery({
    queryKey: queryKeys.parties.list(filters),
    queryFn: ({ pageParam, signal }) => getParties({ ...filters, page: pageParam }, signal),
    initialPageParam: filters.page,
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
  })

  // Flattened back into the single-response shape every consumer already reads.
  // `pagination` comes from the newest page (its `page` is how far the user has
  // scrolled); `summary` from the first, since the totals it carries describe
  // the whole filtered set and do not change page to page.
  const data = useMemo<PartyListResponse | null>(() => {
    const pages = query.data?.pages
    if (!pages?.length) return null
    return {
      parties: pages.flatMap((p) => p.parties),
      pagination: pages[pages.length - 1].pagination,
      summary: pages[0].summary,
    }
  }, [query.data])

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load parties'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  const [pendingSearch, setPendingSearch] = useState<string | null>(null)

  const setSearch = useCallback((term: string) => {
    setPendingSearch(term)
  }, [])

  useEffect(() => {
    if (pendingSearch === null) return
    const timerId = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: pendingSearch, page: 1 }))
      setPendingSearch(null)
    }, TIMEOUTS.debounceMs)
    return () => clearTimeout(timerId)
  }, [pendingSearch])

  const setFilter = useCallback(<K extends keyof PartyFilters>(key: K, value: PartyFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }, [])

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage()
  }, [query])

  const refresh = useCallback(() => {
    invalidatePartyLists(queryClient)
  }, [queryClient])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (formData: PartyFormData) => createParty(formData),
    onSuccess: (created, formData) => {
      toast.success(queuedSuffix(`${formData.name} added successfully`))
      // `null` = queued offline; nothing to fold into the cache until it lands.
      if (created) reconcilePartyCreated(queryClient, created)
    },
    onError: (err: Error) => {
      const message = err instanceof ApiError ? err.message : 'Failed to create party'
      toast.error(message)
    },
  })

  const handleCreate = useCallback(async (formData: PartyFormData) => {
    await createMutation.mutateAsync(formData)
  }, [createMutation])

  // Delete with undo (keeps existing UX: delay actual delete for 5s undo window)
  const handleDelete = useCallback((id: string, name: string) => {
    // Optimistic instant removal across all cached lists. No invalidate — the
    // real delete is deferred 5s (undo window); refetching now would re-add it.
    optimisticRemoveParty(queryClient, id)

    let undone = false

    toast.success(`${name} deleted`, {
      onUndo: () => {
        undone = true
        invalidatePartyLists(queryClient)
      },
      undoLabel: 'Undo',
    })

    setTimeout(() => {
      if (undone) return
      deleteParty(id).catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : 'Failed to delete party'
        toast.error(message)
        invalidatePartyLists(queryClient)
      })
    }, 5_000)
  }, [queryClient, toast])

  return {
    data,
    status,
    filters,
    setSearch,
    setFilter,
    hasMore: query.hasNextPage,
    loadMore,
    isLoadingMore: query.isFetchingNextPage,
    refresh,
    handleCreate,
    handleDelete,
  }
}
