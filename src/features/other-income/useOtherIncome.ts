/** useOtherIncome — Manages other income list state */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { listOtherIncome } from './other-income.service'
import type { OtherIncome } from './other-income.types'

type Status = 'loading' | 'error' | 'success'

interface UseOtherIncomeReturn {
  items: OtherIncome[]
  total: number
  page: number
  status: Status
  categoryFilter: string | null
  setCategoryFilter: (c: string | null) => void
  setPage: (p: number) => void
  refresh: () => void
}

export function useOtherIncome(): UseOtherIncomeReturn {
  const toast = useToast()
  const [categoryFilter, setCategoryFilterState] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<OtherIncome[]>([])
  const [total, setTotal] = useState(0)
  const [fetchStatus, setFetchStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setFetchStatus('loading')
    listOtherIncome(page, categoryFilter, controller.signal)
      .then((res) => { setItems(res.items); setTotal(res.total); setFetchStatus('success') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchStatus('error')
        toast.error(err instanceof ApiError ? err.message : 'Failed to load other income')
      })
    return () => controller.abort()
  }, [page, categoryFilter, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])
  const setCategoryFilter = useCallback((c: string | null) => { setCategoryFilterState(c); setPage(1) }, [])

  return { items, total, page, status: fetchStatus, categoryFilter, setCategoryFilter, setPage, refresh }
}
