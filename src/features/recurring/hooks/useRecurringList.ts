/** useRecurringList — Manages list state, status filter, and pagination */

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { listRecurring } from '../recurring.service'
import type { RecurringInvoice } from '../recurring.types'

type Status = 'loading' | 'error' | 'success'

interface UseRecurringListReturn {
  items: RecurringInvoice[]
  total: number
  page: number
  status: Status
  statusFilter: string
  setStatusFilter: (s: string) => void
  setPage: (p: number) => void
  refresh: () => void
}

export function useRecurringList(): UseRecurringListReturn {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: queryKeys.recurring.list({ page, statusFilter }),
    queryFn: ({ signal }) => listRecurring(page, statusFilter, signal),
  })

  useEffect(() => {
    if (query.isError) {
      const err = query.error
      const message = err instanceof ApiError ? err.message : 'Failed to load recurring invoices'
      toast.error(message)
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all() })
  }, [queryClient])

  const handleStatusFilter = useCallback((s: string) => {
    setStatusFilter(s)
    setPage(1)
  }, [])

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    page,
    status,
    statusFilter,
    setStatusFilter: handleStatusFilter,
    setPage,
    refresh,
  }
}
