/** Stock Summary hook (TanStack Query)
 *
 * Manages paginated stock list with debounced product-name search,
 * filter state, and TanStack Query for caching/abort.
 * All amounts are in PAISE -- display via formatAmount() at render.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { TIMEOUTS } from '@/config/app.config'
import { DEFAULT_PAGE_LIMIT } from '../report.constants'
import { getStockSummary } from '../report.service'
import type { StockSummaryFilters, StockSummaryResponse } from '../report.types'

type Status = 'loading' | 'error' | 'success'

interface UseStockSummaryReturn {
  data: StockSummaryResponse | null
  status: Status
  filters: StockSummaryFilters
  setFilter: <K extends keyof StockSummaryFilters>(
    key: K,
    value: StockSummaryFilters[K],
  ) => void
  setSearch: (term: string) => void
  loadMore: () => void
  refresh: () => void
}

const DEFAULT_FILTERS: StockSummaryFilters = {
  sortBy: 'name_asc',
  limit: DEFAULT_PAGE_LIMIT,
}

export function useStockSummary(): UseStockSummaryReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState<StockSummaryFilters>(DEFAULT_FILTERS)
  const [pendingSearch, setPendingSearch] = useState<string | null>(null)
  const isLoadMore = useRef(false)
  const [mergedData, setMergedData] = useState<StockSummaryResponse | null>(null)

  // Debounce the search input
  useEffect(() => {
    if (pendingSearch === null) return
    const timerId = setTimeout(() => {
      isLoadMore.current = false
      setMergedData(null)
      setFilters((prev) => ({ ...prev, search: pendingSearch, cursor: undefined }))
      setPendingSearch(null)
    }, TIMEOUTS.debounceMs)
    return () => clearTimeout(timerId)
  }, [pendingSearch])

  const query = useQuery({
    queryKey: queryKeys.reports.stockSummary(filters),
    queryFn: ({ signal }) => getStockSummary(filters, signal),
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    if (!query.data) return
    const appendMode = isLoadMore.current
    if (!appendMode || mergedData === null) {
      setMergedData(query.data)
    } else {
      setMergedData((prev) => {
        if (!prev) return query.data!
        return {
          ...query.data!,
          data: {
            summary: query.data!.data.summary,
            items: [...prev.data.items, ...query.data!.data.items],
          },
        }
      })
    }
    isLoadMore.current = false
  }, [query.data]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (query.isError) {
      isLoadMore.current = false
      const err = query.error
      toast.error(err instanceof ApiError ? err.message : 'Failed to load stock summary')
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const setFilter = useCallback(
    <K extends keyof StockSummaryFilters>(key: K, value: StockSummaryFilters[K]) => {
      isLoadMore.current = false
      setMergedData(null)
      setFilters((prev) => ({ ...prev, [key]: value, cursor: undefined }))
    },
    [],
  )

  const setSearch = useCallback((term: string) => {
    setPendingSearch(term)
  }, [])

  const loadMore = useCallback(() => {
    if (!mergedData?.meta.hasMore || !mergedData.meta.cursor) return
    isLoadMore.current = true
    setFilters((prev) => ({ ...prev, cursor: mergedData.meta.cursor ?? undefined }))
  }, [mergedData])

  const refresh = useCallback(() => {
    isLoadMore.current = false
    setMergedData(null)
    setFilters((prev) => ({ ...prev, cursor: undefined }))
    queryClient.invalidateQueries({ queryKey: ['reports', 'stock-summary'] })
  }, [queryClient])

  return { data: mergedData, status, filters, setFilter, setSearch, loadMore, refresh }
}
