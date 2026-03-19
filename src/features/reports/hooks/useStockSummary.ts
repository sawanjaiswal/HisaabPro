/** Stock Summary hook
 *
 * Manages paginated stock list with debounced product-name search,
 * filter state, and abort-on-cleanup for every fetch.
 * All amounts are in PAISE — display via formatAmount() at render.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
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

  const [filters, setFilters] = useState<StockSummaryFilters>(DEFAULT_FILTERS)
  const [data, setData] = useState<StockSummaryResponse | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  // Debounced search state — null means no pending search
  const [pendingSearch, setPendingSearch] = useState<string | null>(null)

  const isLoadMore = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    const appendMode = isLoadMore.current

    if (!appendMode) {
      setStatus('loading')
    }

    getStockSummary(filters, controller.signal)
      .then((response: StockSummaryResponse) => {
        setData((prev) => {
          if (!appendMode || prev === null) return response
          return {
            ...response,
            data: {
              summary: response.data.summary,
              items: [...prev.data.items, ...response.data.items],
            },
          }
        })
        setStatus('success')
        isLoadMore.current = false
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        isLoadMore.current = false
        const message =
          err instanceof ApiError ? err.message : 'Failed to load stock summary'
        toast.error(message)
      })

    return () => controller.abort()
  }, [filters, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce the search input — fire API call only after 300ms idle
  useEffect(() => {
    if (pendingSearch === null) return
    const timerId = setTimeout(() => {
      isLoadMore.current = false
      setFilters((prev) => ({ ...prev, search: pendingSearch, cursor: undefined }))
      setPendingSearch(null)
    }, TIMEOUTS.debounceMs)
    return () => clearTimeout(timerId)
  }, [pendingSearch])

  const setFilter = useCallback(
    <K extends keyof StockSummaryFilters>(key: K, value: StockSummaryFilters[K]) => {
      isLoadMore.current = false
      setFilters((prev) => ({ ...prev, [key]: value, cursor: undefined }))
    },
    [],
  )

  const setSearch = useCallback((term: string) => {
    setPendingSearch(term)
  }, [])

  const loadMore = useCallback(() => {
    if (!data?.meta.hasMore || !data.meta.cursor) return
    isLoadMore.current = true
    setFilters((prev) => ({ ...prev, cursor: data.meta.cursor ?? undefined }))
  }, [data])

  const refresh = useCallback(() => {
    isLoadMore.current = false
    setFilters((prev) => ({ ...prev, cursor: undefined }))
    setRefreshKey((k) => k + 1)
  }, [])

  return { data, status, filters, setFilter, setSearch, loadMore, refresh }
}
