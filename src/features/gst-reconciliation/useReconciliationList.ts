/** useReconciliationList — fetches paginated list of reconciliations */

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { listReconciliations, deleteReconciliation } from './reconciliation.service'
import { RECON_PAGE_LIMIT } from './reconciliation.constants'
import type { ReconciliationSummary } from './reconciliation.types'

type Status = 'loading' | 'error' | 'success'

interface UseReconciliationListReturn {
  items: ReconciliationSummary[]
  status: Status
  page: number
  total: number
  hasMore: boolean
  loadMore: () => void
  remove: (id: string) => Promise<void>
  refresh: () => void
}

export function useReconciliationList(): UseReconciliationListReturn {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: queryKeys.gstReconciliation.list({ page }),
    queryFn: ({ signal }) =>
      listReconciliations({ page, limit: RECON_PAGE_LIMIT }, signal),
  })

  useEffect(() => {
    if (query.isError) {
      const err = query.error
      const message = err instanceof ApiError ? err.message : 'Failed to load reconciliations'
      toast.error(message)
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'
  const items = query.data?.data ?? []
  const total = query.data?.total ?? 0
  const hasMore = items.length < total

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReconciliation(id),
    onSuccess: () => {
      toast.success('Reconciliation deleted')
      void queryClient.invalidateQueries({ queryKey: queryKeys.gstReconciliation.all() })
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Failed to delete reconciliation'
      toast.error(message)
    },
  })

  const loadMore = useCallback(() => {
    setPage((p) => p + 1)
  }, [])

  const refresh = useCallback(() => {
    setPage(1)
    void queryClient.invalidateQueries({ queryKey: queryKeys.gstReconciliation.all() })
  }, [queryClient])

  const remove = useCallback(async (id: string) => {
    await deleteMutation.mutateAsync(id)
  }, [deleteMutation])

  return { items, status, page, total, hasMore, loadMore, remove, refresh }
}
