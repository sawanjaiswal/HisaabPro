/** Payment History Report hook (TanStack Query)
 *
 * Manages paginated payment history with filter state, cursor-based load-more.
 * All amounts are in PAISE -- display via formatAmount() at render.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState<PaymentHistoryFilters>(buildDefaultFilters)
  const isLoadMore = useRef(false)
  const [mergedData, setMergedData] = useState<PaymentHistoryResponse | null>(null)

  const query = useQuery({
    queryKey: queryKeys.reports.paymentHistory(filters),
    queryFn: ({ signal }) => getPaymentHistory(filters, signal),
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
      toast.error(err instanceof ApiError ? err.message : 'Failed to load payment history')
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const setFilter = useCallback(
    <K extends keyof PaymentHistoryFilters>(
      key: K,
      value: PaymentHistoryFilters[K],
    ) => {
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
    queryClient.invalidateQueries({ queryKey: ['reports', 'payment-history'] })
  }, [queryClient])

  return { data: mergedData, status, filters, setFilter, loadMore, refresh }
}
