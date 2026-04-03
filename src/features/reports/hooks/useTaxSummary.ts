/** Tax Summary hook (TanStack Query)
 *
 * Fetches tax summary and HSN summary in parallel for a given date range.
 * All amounts are in PAISE.
 */

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState<TaxSummaryFilters>(buildDefaultFilters)

  const query = useQuery({
    queryKey: queryKeys.reports.taxSummary(filters),
    queryFn: async ({ signal }) => {
      const [summary, hsnSummary] = await Promise.all([
        getTaxSummary(filters, signal),
        getHsnSummary(filters, signal),
      ])
      return { summary, hsnSummary }
    },
  })

  useEffect(() => {
    if (query.isError) {
      const err = query.error
      toast.error(err instanceof ApiError ? err.message : 'Failed to load tax summary')
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.taxSummary(filters) })
  }, [queryClient, filters])

  return {
    data: query.data ?? { summary: null, hsnSummary: null },
    status,
    filters,
    setFilters,
    refresh,
  }
}
