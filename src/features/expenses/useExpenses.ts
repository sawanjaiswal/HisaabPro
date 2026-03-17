/** useExpenses — Manages expense list + category filter state */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { listExpenses } from './expense.service'
import type { Expense } from './expense.types'

type Status = 'loading' | 'error' | 'success'

interface UseExpensesReturn {
  items: Expense[]
  total: number
  page: number
  status: Status
  categoryFilter: string | null
  setCategoryFilter: (id: string | null) => void
  setPage: (p: number) => void
  refresh: () => void
}

export function useExpenses(): UseExpensesReturn {
  const toast = useToast()
  const [categoryFilter, setCategoryFilterState] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Expense[]>([])
  const [total, setTotal] = useState(0)
  const [fetchStatus, setFetchStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setFetchStatus('loading')

    listExpenses(page, categoryFilter, controller.signal)
      .then((res) => {
        setItems(res.items)
        setTotal(res.total)
        setFetchStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load expenses'
        toast.error(message)
      })

    return () => controller.abort()
  }, [page, categoryFilter, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const setCategoryFilter = useCallback((id: string | null) => {
    setCategoryFilterState(id)
    setPage(1)
  }, [])

  return { items, total, page, status: fetchStatus, categoryFilter, setCategoryFilter, setPage, refresh }
}
