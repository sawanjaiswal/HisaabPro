/** TDS/TCS Report hook
 *
 * Manages date range + type filter state, fetches the summary, and aborts
 * in-flight requests on cleanup to prevent stale state updates.
 * All amounts in PAISE. Rates in BASIS POINTS.
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { getDateRange } from '../report.utils'
import { getTdsTcsSummary } from '../report.service'
import type { TdsTcsFilters, TdsTcsSummaryData } from '../report-tax.types'

type Status = 'loading' | 'error' | 'success'

interface UseTdsTcsReturn {
  data: TdsTcsSummaryData | null
  status: Status
  filters: TdsTcsFilters
  setFilters: (filters: TdsTcsFilters) => void
  refresh: () => void
}

function buildDefaultFilters(): TdsTcsFilters {
  return { ...getDateRange('this_fy'), type: 'all' }
}

export function useTdsTcs(): UseTdsTcsReturn {
  const toast = useToast()

  const [filters, setFilters] = useState<TdsTcsFilters>(buildDefaultFilters)
  const [data, setData] = useState<TdsTcsSummaryData | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    getTdsTcsSummary(filters, controller.signal)
      .then((summary) => {
        setData(summary)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message =
          err instanceof ApiError ? err.message : 'Failed to load TDS/TCS report'
        toast.error(message)
      })

    return () => controller.abort()
  }, [filters, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return { data, status, filters, setFilters, refresh }
}
