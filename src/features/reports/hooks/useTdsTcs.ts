/** TDS/TCS Report hook (TanStack Query)
 *
 * Manages date range + type filter state, fetches the summary via TanStack Query.
 * All amounts in PAISE. Rates in BASIS POINTS.
 */

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState<TdsTcsFilters>(buildDefaultFilters)

  const query = useQuery({
    queryKey: queryKeys.reports.tdsTcs(filters),
    queryFn: ({ signal }) => getTdsTcsSummary(filters, signal),
  })

  useEffect(() => {
    if (query.isError) {
      const err = query.error
      toast.error(err instanceof ApiError ? err.message : 'Failed to load TDS/TCS report')
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.tdsTcs(filters) })
  }, [queryClient, filters])

  return { data: query.data ?? null, status, filters, setFilters, refresh }
}
