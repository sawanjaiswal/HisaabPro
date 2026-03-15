/** Outstanding — List hook
 *
 * Manages paginated outstanding party list, debounced search, filter state,
 * and manual refresh. Follows the same pattern as usePayments.ts.
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { TIMEOUTS } from '@/config/app.config'
import { DEFAULT_OUTSTANDING_FILTERS } from './payment.constants'
import { getOutstanding } from './payment.service'
import type {
  OutstandingListResponse,
  OutstandingFilters,
  OutstandingType,
  OutstandingSortBy,
} from './payment.types'

type Status = 'loading' | 'error' | 'success'

interface UseOutstandingOptions {
  initialFilters?: Partial<OutstandingFilters>
}

interface UseOutstandingReturn {
  data: OutstandingListResponse | null
  status: Status
  filters: OutstandingFilters
  setSearch: (term: string) => void
  setFilter: <K extends keyof OutstandingFilters>(key: K, value: OutstandingFilters[K]) => void
  setPage: (page: number) => void
  refresh: () => void
}

export function useOutstanding({
  initialFilters,
}: UseOutstandingOptions = {}): UseOutstandingReturn {
  const toast = useToast()

  const [filters, setFilters] = useState<OutstandingFilters>({
    ...DEFAULT_OUTSTANDING_FILTERS,
    ...initialFilters,
  })
  const [data, setData] = useState<OutstandingListResponse | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch outstanding whenever filters or refreshKey change
  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    getOutstanding(filters, controller.signal)
      .then((response: OutstandingListResponse) => {
        setData(response)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load outstanding'
        toast.error(message)
      })

    return () => controller.abort()
  }, [filters, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search — holds the raw input, effect fires API after 300ms idle
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

  const setFilter = useCallback(<K extends keyof OutstandingFilters>(
    key: K,
    value: OutstandingFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }, [])

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return {
    data,
    status,
    filters,
    setSearch,
    setFilter,
    setPage,
    refresh,
  }
}

// Re-export filter types needed by caller components
export type { OutstandingType, OutstandingSortBy }
