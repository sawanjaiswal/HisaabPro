/** Dashboard — 0ms Local-First State Hook
 *
 * Serves dashboard data instantly from Dexie via DashboardRepository.
 * Background SWR updates from /dashboard/home without blocking UI.
 * All amounts in PAISE (integer).
 */

import { useCallback, useMemo, useEffect } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { useLiveQuery, liveQueryMemoryCache } from '@/hooks/useLiveQuery'
import { liveQueryBus } from '@/domain/live-query-bus'
import { DashboardRepository } from '@/repositories/dashboard.repository'
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
  const repo = useMemo(() => new DashboardRepository(), [])

  const { data: rawData, isLoading, error, refetch } = useLiveQuery(
    ['dashboard'],
    async () => {
      let local: HomeDashboardData | null = null
      try {
        local = await repo.getHomeData()
      } catch {}

      const hasLocalData =
        local &&
        (local.outstanding.receivable.total > 0 ||
          local.outstanding.payable.total > 0 ||
          local.today.salesCount > 0 ||
          local.today.paymentsReceivedCount > 0 ||
          local.recentActivity.length > 0)

      if (hasLocalData) {
        void getHomeDashboard().catch(() => {})
        return local
      }

      try {
        return await getHomeDashboard()
      } catch (err: any) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return new Promise<HomeDashboardData>(() => {})
        }
        if (hasLocalData && local) return local
        throw err
      }
    }
  )

  const isAbortError = error instanceof DOMException && error.name === 'AbortError'
  const data = rawData ?? null
  const status: Status = isLoading || isAbortError
    ? 'loading'
    : error && !data ? 'error' : 'success'

  useEffect(() => {
    if (error && !data && !isAbortError) {
      const message = error instanceof ApiError ? error.message : 'Failed to load dashboard'
      toast.error(message)
    }
  }, [error, data, isAbortError, toast])

  const refresh = useCallback(async () => {
    try {
      const remote = await getHomeDashboard()
      liveQueryMemoryCache.set(JSON.stringify(['dashboard']), remote)
      liveQueryBus.invalidate(['dashboard'])
    } catch {}
    void refetch()
  }, [refetch])

  return { data, status, refresh }
}
