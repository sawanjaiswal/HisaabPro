/** useTrialBalance — Fetches trial balance with optional as-of date */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { getTrialBalance } from './accounting.service'
import { getTodayISO } from './accounting.utils'
import type { TrialBalanceData } from './accounting.types'

type Status = 'loading' | 'error' | 'success'

interface UseTrialBalanceReturn {
  data: TrialBalanceData | null
  status: Status
  asOf: string
  setAsOf: (date: string) => void
  refresh: () => void
}

export function useTrialBalance(): UseTrialBalanceReturn {
  const toast = useToast()
  const [asOf, setAsOfDate] = useState<string>(getTodayISO)
  const [data, setData] = useState<TrialBalanceData | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    getTrialBalance(asOf, controller.signal)
      .then((res) => {
        setData(res)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load trial balance'
        toast.error(message)
      })

    return () => controller.abort()
  }, [asOf, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const setAsOf = useCallback((date: string) => {
    setAsOfDate(date)
  }, [])

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return { data, status, asOf, setAsOf, refresh }
}
