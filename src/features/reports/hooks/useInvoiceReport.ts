/** Invoice Report hook — sale or purchase
 *
 * Manages paginated invoice report state including filters, load-more cursor
 * pagination, and abort-on-cleanup for every fetch.
 *
 * All monetary amounts are in PAISE — display via formatAmount() at render.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { getDateRange, getTodayISO } from '../report.utils'
import { getInvoiceReport } from '../report.service'
import type {
  InvoiceReportFilters,
  InvoiceReportResponse,
  InvoiceReportType,
} from '../report.types'

type Status = 'loading' | 'error' | 'success'

interface UseInvoiceReportOptions {
  type: InvoiceReportType
}

interface UseInvoiceReportReturn {
  data: InvoiceReportResponse | null
  status: Status
  filters: InvoiceReportFilters
  setFilter: <K extends keyof InvoiceReportFilters>(
    key: K,
    value: InvoiceReportFilters[K],
  ) => void
  loadMore: () => void
  refresh: () => void
}

function buildDefaultFilters(type: InvoiceReportType): InvoiceReportFilters {
  const { from } = getDateRange('this_month')
  const to = getTodayISO()
  return {
    type,
    from,
    to,
    groupBy: 'none',
    sortBy: 'date_desc',
    limit: 20,
  }
}

export function useInvoiceReport({
  type,
}: UseInvoiceReportOptions): UseInvoiceReportReturn {
  const toast = useToast()

  const [filters, setFilters] = useState<InvoiceReportFilters>(() =>
    buildDefaultFilters(type),
  )
  const [data, setData] = useState<InvoiceReportResponse | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  // Track whether we are appending (load-more) or replacing (filter change)
  const isLoadMore = useRef(false)

  useEffect(() => {
    const controller = new AbortController()

    if (!isLoadMore.current) {
      setStatus('loading')
    }

    getInvoiceReport(filters, controller.signal)
      .then((response: InvoiceReportResponse) => {
        setData((prev) => {
          if (!isLoadMore.current || prev === null) return response
          // Merge paginated results — append items or groups
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
          err instanceof ApiError ? err.message : 'Failed to load invoice report'
        toast.error(message)
      })

    return () => controller.abort()
  }, [filters, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = useCallback(
    <K extends keyof InvoiceReportFilters>(key: K, value: InvoiceReportFilters[K]) => {
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
