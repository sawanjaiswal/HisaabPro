/** Payment History Report hook
 *
 * Manages paginated payment history with filter state, cursor-based load-more,
 * and abort-on-cleanup for every fetch.
 * All amounts are in PAISE — display via formatAmount() at render.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { DEFAULT_PAGE_LIMIT } from '../report.constants'
import { getDateRange, getTodayISO } from '../report.utils'
import { getPaymentHistory } from '../report.service'
import type {
  PaymentHistoryFilters,
  PaymentHistoryResponse,
} from '../report.types'

type Status = 'loading' | 'error' | 'success'

interface UsePaymentHistoryReportReturn {
  data: PaymentHistoryResponse | null
  status: Status
  filters: PaymentHistoryFilters
  setFilter: <K extends keyof PaymentHistoryFilters>(
    key: K,
    value: PaymentHistoryFilters[K],
  ) => void
  loadMore: () => void
  refresh: () => void
}

function buildDefaultFilters(): PaymentHistoryFilters {
  const { from } = getDateRange('this_month')
  const to = getTodayISO()
  return {
    from,
    to,
    groupBy: 'none',
    sortBy: 'date_desc',
    limit: DEFAULT_PAGE_LIMIT,
  }
}

export function usePaymentHistoryReport(): UsePaymentHistoryReportReturn {
  const toast = useToast()

  const [filters, setFilters] = useState<PaymentHistoryFilters>(buildDefaultFilters)
  const [data, setData] = useState<PaymentHistoryResponse | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  const isLoadMore = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    const appendMode = isLoadMore.current

    if (!appendMode) {
      setStatus('loading')
    }

    getPaymentHistory(filters, controller.signal)
      .then((response: PaymentHistoryResponse) => {
        setData((prev) => {
          if (!appendMode || prev === null) return response
          const prevItems = prev.data.items ?? []
          const nextItems = response.data.items ?? []
          const prevGroups = prev.data.groups ?? []
          const nextGroups = response.data.groups ?? []
          return {
            ...response,
            data: {
              summary: response.data.summary,
              items: nextItems.length > 0 ? [...prevItems, ...nextItems] : undefined,
              groups: nextGroups.length > 0 ? [...prevGroups, ...nextGroups] : undefined,
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
          err instanceof ApiError ? err.message : 'Failed to load payment history'
        toast.error(message)
      })

    return () => controller.abort()
  }, [filters, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = useCallback(
    <K extends keyof PaymentHistoryFilters>(
      key: K,
      value: PaymentHistoryFilters[K],
    ) => {
      isLoadMore.current = false
      setFilters((prev) => ({ ...prev, [key]: value, cursor: undefined }))
    },
    [],
  )

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

  return { data, status, filters, setFilter, loadMore, refresh }
}
