/** Dashboard — State hook
 *
 * Owns filter state, AbortController lifecycle, and fetch orchestration.
 * Returns exactly what Dashboard.tsx needs — nothing more.
 * All amounts in PAISE (integer).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getDashboardStats } from './dashboard.service'
import { DEFAULT_DASHBOARD_FILTERS } from './dashboard.constants'
import type { DashboardStats, DashboardFilters, DashboardRange } from './dashboard.types'

type Status = 'loading' | 'error' | 'success'

interface UseDashboardReturn {
  stats: DashboardStats | null
  status: Status
  filters: DashboardFilters
  setRange: (range: DashboardRange) => void
  setCustomRange: (from: string, to: string) => void
  refresh: () => void
}

export function useDashboard(): UseDashboardReturn {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_DASHBOARD_FILTERS)
  const abortRef = useRef<AbortController | null>(null)

  const fetchStats = useCallback(async (f: DashboardFilters) => {
    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('loading')

    try {
      // service returns DashboardStats directly — api() unwraps success/data
      const data = await getDashboardStats(f, controller.signal)

      if (!controller.signal.aborted) {
        setStats(data)
        setStatus('success')
      }
    } catch (err) {
      // Ignore AbortError — it is expected on filter change / unmount
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (err instanceof Error && err.name === 'AbortError') return

      if (!controller.signal.aborted) {
        setStatus('error')
      }
    }
  }, [])

  useEffect(() => {
    void fetchStats(filters)
    return () => {
      abortRef.current?.abort()
    }
  }, [filters, fetchStats])

  const setRange = useCallback((range: DashboardRange) => {
    setFilters((prev) => ({ ...prev, range }))
  }, [])

  const setCustomRange = useCallback((from: string, to: string) => {
    setFilters({ range: 'custom', from, to })
  }, [])

  const refresh = useCallback(() => {
    void fetchStats(filters)
  }, [fetchStats, filters])

  return { stats, status, filters, setRange, setCustomRange, refresh }
}
