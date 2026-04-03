/** useOtherIncome — Manages other income list state */

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()
  const [categoryFilter, setCategoryFilterState] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: queryKeys.otherIncome.list({ page, categoryFilter }),
    queryFn: ({ signal }) => listOtherIncome(page, categoryFilter, signal),
  })

  useEffect(() => {
    if (query.isError) {
      const err = query.error
      toast.error(err instanceof ApiError ? err.message : 'Failed to load other income')
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.otherIncome.all() })
  }, [queryClient])

  const setCategoryFilter = useCallback((c: string | null) => {
    setCategoryFilterState(c)
    setPage(1)
  }, [])

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    page,
    status,
    categoryFilter,
    setCategoryFilter,
    setPage,
    refresh,
  }
}
