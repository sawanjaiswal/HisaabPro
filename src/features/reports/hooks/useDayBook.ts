/** Day Book hook
 *
 * Manages the day book for a specific date with next/prev navigation,
 * transaction-type filter, load-more pagination, and abort-on-cleanup.
 * All amounts are in PAISE — display via formatAmount() at render.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
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

  const [filters, setFilters] = useState<DayBookFilters>(buildDefaultFilters)
  const [data, setData] = useState<DayBookResponse | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  const isLoadMore = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    const appendMode = isLoadMore.current

    if (!appendMode) {
      setStatus('loading')
    }

    getDayBook(filters, controller.signal)
      .then((response: DayBookResponse) => {
        setData((prev) => {
          if (!appendMode || prev === null) return response
          return {
            ...response,
            data: {
              ...response.data,
              transactions: [
                ...prev.data.transactions,
                ...response.data.transactions,
              ],
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
          err instanceof ApiError ? err.message : 'Failed to load day book'
        toast.error(message)
      })

    return () => controller.abort()
  }, [filters, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const setDate = useCallback((date: string) => {
    isLoadMore.current = false
    setData(null)
    setFilters((prev) => ({ ...prev, date, cursor: undefined }))
  }, [])

  const setTypeFilter = useCallback((type: DayBookTransactionType | undefined) => {
    isLoadMore.current = false
    setFilters((prev) => ({ ...prev, type, cursor: undefined }))
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

  const goToPrevDay = useCallback(() => {
    setDate(getPrevDate(filters.date))
  }, [filters.date, setDate])

  const goToNextDay = useCallback(() => {
    const next = getNextDate(filters.date)
    if (next !== null) setDate(next)
  }, [filters.date, setDate])

  return {
    data,
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
