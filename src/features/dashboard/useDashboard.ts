/** Dashboard — State hook (TanStack Query)
 *
 * Fetches the home dashboard data in a single call.
 * Returns exactly what DashboardPage.tsx needs.
 * All amounts in PAISE (integer).
 */

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { getHomeDashboard } from './dashboard.service'
import type { HomeDashboardData } from './dashboard.types'

type Status = 'loading' | 'error' | 'success'

interface UseHomeDashboardReturn {
  data: HomeDashboardData | null
  status: Status
  refresh: () => void
}

export function useHomeDashboard(): UseHomeDashboardReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: ({ signal }) => getHomeDashboard(signal),
  })

  const data = query.data ?? null
  // AbortError is fired when React Strict Mode (or rapid remount) cancels the
  // first in-flight request — surface it as still-loading, not as a hard error,
  // so the dashboard doesn't flash a banner on every dev refresh.
  const isAbortError = query.error instanceof DOMException && query.error.name === 'AbortError'
  const status: Status = query.isPending || isAbortError
    ? 'loading'
    : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error && !isAbortError) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load dashboard'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() })
  }

  return { data, status, refresh }
}
