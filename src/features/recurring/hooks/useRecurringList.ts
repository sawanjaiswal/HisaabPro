/** useRecurringList — Manages list state, status filter, and pagination
 *
 * AbortController cleanup prevents stale updates when status/page changes
 * mid-flight. refreshKey forces re-fetch without changing other deps.
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
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

  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<RecurringInvoice[]>([])
  const [total, setTotal] = useState(0)
  const [fetchStatus, setFetchStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setFetchStatus('loading')

    listRecurring(page, statusFilter, controller.signal)
      .then((res) => {
        setItems(res.items)
        setTotal(res.total)
        setFetchStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchStatus('error')
        const message =
          err instanceof ApiError ? err.message : 'Failed to load recurring invoices'
        toast.error(message)
      })

    return () => controller.abort()
  }, [page, statusFilter, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const handleStatusFilter = useCallback((s: string) => {
    setStatusFilter(s)
    setPage(1)
  }, [])

  return {
    items,
    total,
    page,
    status: fetchStatus,
    statusFilter,
    setStatusFilter: handleStatusFilter,
    setPage,
    refresh,
  }
}
