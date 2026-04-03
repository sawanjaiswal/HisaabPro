/** Invoice Report hook -- sale or purchase (TanStack Query)
 *
 * Manages paginated invoice report state including filters, load-more cursor
 * pagination via TanStack Query.
 * All monetary amounts are in PAISE -- display via formatAmount() at render.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState<InvoiceReportFilters>(() =>
    buildDefaultFilters(type),
  )
  const isLoadMore = useRef(false)
  const [mergedData, setMergedData] = useState<InvoiceReportResponse | null>(null)

  const query = useQuery({
    queryKey: queryKeys.reports.invoiceReport(filters),
    queryFn: ({ signal }) => getInvoiceReport(filters, signal),
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
        const prevItems = prev.data.items ?? []
        const nextItems = query.data!.data.items ?? []
        const prevGroups = prev.data.groups ?? []
        const nextGroups = query.data!.data.groups ?? []
        return {
          ...query.data!,
          data: {
            summary: query.data!.data.summary,
            items: nextItems.length > 0 ? [...prevItems, ...nextItems] : undefined,
            groups: nextGroups.length > 0 ? [...prevGroups, ...nextGroups] : undefined,
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
      toast.error(err instanceof ApiError ? err.message : 'Failed to load invoice report')
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const setFilter = useCallback(
    <K extends keyof InvoiceReportFilters>(key: K, value: InvoiceReportFilters[K]) => {
      isLoadMore.current = false
      setMergedData(null)
      setFilters((prev) => ({ ...prev, [key]: value, cursor: undefined }))
    },
    [],
  )

  const loadMore = useCallback(() => {
    if (!mergedData?.meta.hasMore || !mergedData.meta.cursor) return
    isLoadMore.current = true
    setFilters((prev) => ({ ...prev, cursor: mergedData.meta.cursor ?? undefined }))
  }, [mergedData])

  const refresh = useCallback(() => {
    isLoadMore.current = false
    setMergedData(null)
    setFilters((prev) => ({ ...prev, cursor: undefined }))
    queryClient.invalidateQueries({ queryKey: ['reports', 'invoice-report'] })
  }, [queryClient])

  return { data: mergedData, status, filters, setFilter, loadMore, refresh }
}
