/** useExpenses — Manages expense list + category filter state (TanStack Query) */

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()
  const [categoryFilter, setCategoryFilterState] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const filters = { page, categoryFilter }

  const query = useQuery({
    queryKey: queryKeys.expenses.list(filters),
    queryFn: ({ signal }) => listExpenses(page, categoryFilter, signal),
  })

  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load expenses'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all() })
  }, [queryClient])

  const setCategoryFilter = useCallback((id: string | null) => {
    setCategoryFilterState(id)
    setPage(1)
  }, [])

  return { items, total, page, status, categoryFilter, setCategoryFilter, setPage, refresh }
}
