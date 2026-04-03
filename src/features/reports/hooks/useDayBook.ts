/** Day Book hook (TanStack Query)
 *
 * Manages the day book for a specific date with next/prev navigation,
 * transaction-type filter, load-more pagination via keepPreviousData.
 * All amounts are in PAISE -- display via formatAmount() at render.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { STATEMENT_PAGE_LIMIT } from '../report.constants'
import { getTodayISO, getPrevDate, getNextDate } from '../report.utils'
import { getDayBook } from '../report.service'
import type {
  DayBookFilters,
  DayBookResponse,
  DayBookTransactionType,
} from '../report.types'

type Status = 'loading' | 'error' | 'success'

interface UseDayBookReturn {
  data: DayBookResponse | null
  status: Status
  filters: DayBookFilters
  setDate: (date: string) => void
  setTypeFilter: (type: DayBookTransactionType | undefined) => void
  loadMore: () => void
  refresh: () => void
  goToPrevDay: () => void
  goToNextDay: () => void
}

function buildDefaultFilters(): DayBookFilters {
  return {
    date: getTodayISO(),
    limit: STATEMENT_PAGE_LIMIT,
  }
}

export function useDayBook(): UseDayBookReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState<DayBookFilters>(buildDefaultFilters)
  const isLoadMore = useRef(false)
  const [mergedData, setMergedData] = useState<DayBookResponse | null>(null)

  const query = useQuery({
    queryKey: queryKeys.reports.dayBook(filters),
    queryFn: ({ signal }) => getDayBook(filters, signal),
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
            ...query.data!.data,
            transactions: [
              ...prev.data.transactions,
              ...query.data!.data.transactions,
            ],
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
      toast.error(err instanceof ApiError ? err.message : 'Failed to load day book')
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const setDate = useCallback((date: string) => {
    isLoadMore.current = false
    setMergedData(null)
    setFilters((prev) => ({ ...prev, date, cursor: undefined }))
  }, [])

  const setTypeFilter = useCallback((type: DayBookTransactionType | undefined) => {
    isLoadMore.current = false
    setFilters((prev) => ({ ...prev, type, cursor: undefined }))
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
    queryClient.invalidateQueries({ queryKey: ['reports', 'day-book'] })
  }, [queryClient])

  const goToPrevDay = useCallback(() => {
    setDate(getPrevDate(filters.date))
  }, [filters.date, setDate])

  const goToNextDay = useCallback(() => {
    const next = getNextDate(filters.date)
    if (next !== null) setDate(next)
  }, [filters.date, setDate])

  return {
    data: mergedData,
    status,
    filters,
    setDate,
    setTypeFilter,
    loadMore,
    refresh,
    goToPrevDay,
    goToNextDay,
  }
}
