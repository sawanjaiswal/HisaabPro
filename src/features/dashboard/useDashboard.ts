/** Dashboard — State hook
 *
 * Fetches the home dashboard data in a single call.
 * Returns exactly what DashboardPage.tsx needs.
 * All amounts in PAISE (integer).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getHomeDashboard } from './dashboard.service'
import type { HomeDashboardData } from './dashboard.types'

type Status = 'loading' | 'error' | 'success'

interface UseHomeDashboardReturn {
  data: HomeDashboardData | null
  status: Status
  refresh: () => void
}

export function useHomeDashboard(): UseHomeDashboardReturn {
  const [data, setData] = useState<HomeDashboardData | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('loading')

    try {
      const result = await getHomeDashboard(controller.signal)
      if (!controller.signal.aborted) {
        setData(result)
        setStatus('success')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (err instanceof Error && err.name === 'AbortError') return
      if (!controller.signal.aborted) {
        setStatus('error')
      }
    }
  }, [])

  useEffect(() => {
    void fetchData()
    return () => { abortRef.current?.abort() }
  }, [fetchData])

  const refresh = useCallback(() => {
    void fetchData()
  }, [fetchData])

  return { data, status, refresh }
}
