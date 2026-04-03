/** useCheques — Manages cheque list with status filter */

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { listCheques } from './cheque.service'
import type { Cheque } from './cheque.types'

type Status = 'loading' | 'error' | 'success'

interface UseChequesReturn {
  items: Cheque[]
  total: number
  page: number
  status: Status
  statusFilter: string
  setStatusFilter: (s: string) => void
  setPage: (p: number) => void
  refresh: () => void
}

export function useCheques(): UseChequesReturn {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilterState] = useState('ALL')
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: queryKeys.cheques.list({ page, statusFilter }),
    queryFn: ({ signal }) => listCheques(page, statusFilter, signal),
  })

  useEffect(() => {
    if (query.isError) {
      const err = query.error
      toast.error(err instanceof ApiError ? err.message : 'Failed to load cheques')
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cheques.all() })
  }, [queryClient])

  const setStatusFilter = useCallback((s: string) => {
    setStatusFilterState(s)
    setPage(1)
  }, [])

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    page,
    status,
    statusFilter,
    setStatusFilter,
    setPage,
    refresh,
  }
}
