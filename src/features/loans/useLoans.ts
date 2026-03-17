/** useLoans — Manages loan list state */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { listLoans } from './loan.service'
import type { Loan } from './loan.types'

type Status = 'loading' | 'error' | 'success'

interface UseLoansReturn {
  items: Loan[]
  total: number
  status: Status
  refresh: () => void
}

export function useLoans(): UseLoansReturn {
  const toast = useToast()
  const [items, setItems] = useState<Loan[]>([])
  const [total, setTotal] = useState(0)
  const [fetchStatus, setFetchStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setFetchStatus('loading')
    listLoans(controller.signal)
      .then((res) => { setItems(res.items); setTotal(res.total); setFetchStatus('success') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchStatus('error')
        toast.error(err instanceof ApiError ? err.message : 'Failed to load loans')
      })
    return () => controller.abort()
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  return { items, total, status: fetchStatus, refresh }
}
