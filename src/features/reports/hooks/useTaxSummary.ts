/** Tax Summary hook
 *
 * Fetches tax summary and HSN summary in parallel for a given date range.
 * Aborts both fetches on cleanup. All amounts are in PAISE.
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { getDateRange } from '../report.utils'
import { getTaxSummary, getHsnSummary } from '../report.service'
import type { TaxSummaryFilters, TaxSummaryData, HsnSummaryData } from '../report-tax.types'

type Status = 'loading' | 'error' | 'success'

interface TaxSummaryResult {
  summary: TaxSummaryData | null
  hsnSummary: HsnSummaryData | null
}

interface UseTaxSummaryReturn {
  data: TaxSummaryResult
  status: Status
  filters: TaxSummaryFilters
  setFilters: (filters: TaxSummaryFilters) => void
  refresh: () => void
}

function buildDefaultFilters(): TaxSummaryFilters {
  return getDateRange('this_fy')
}

export function useTaxSummary(): UseTaxSummaryReturn {
  const toast = useToast()

  const [filters, setFilters] = useState<TaxSummaryFilters>(buildDefaultFilters)
  const [data, setData] = useState<TaxSummaryResult>({ summary: null, hsnSummary: null })
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    Promise.all([
      getTaxSummary(filters, controller.signal),
      getHsnSummary(filters, controller.signal),
    ])
      .then(([summary, hsnSummary]) => {
        setData({ summary, hsnSummary })
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message =
          err instanceof ApiError ? err.message : 'Failed to load tax summary'
        toast.error(message)
      })

    return () => controller.abort()
  }, [filters, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return { data, status, filters, setFilters, refresh }
}
