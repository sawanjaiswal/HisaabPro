/** useReconciliationList — fetches paginated list of reconciliations */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
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

  const [items, setItems]   = useState<ReconciliationSummary[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [page, setPage]     = useState(1)
  const [total, setTotal]   = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    listReconciliations({ page, limit: RECON_PAGE_LIMIT }, controller.signal)
      .then((res) => {
        setItems((prev) => page === 1 ? res.data : [...prev, ...res.data])
        setTotal(res.total)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load reconciliations'
        toast.error(message)
      })

    return () => controller.abort()
  }, [page, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    setPage((p) => p + 1)
  }, [])

  const refresh = useCallback(() => {
    setPage(1)
    setItems([])
    setRefreshKey((k) => k + 1)
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteReconciliation(id)
    toast.success('Reconciliation deleted')
    refresh()
  }, [refresh, toast])

  const hasMore = items.length < total

  return { items, status, page, total, hasMore, loadMore, remove, refresh }
}
