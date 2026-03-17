/** useCheques — Manages cheque list with status filter */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
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
  const [statusFilter, setStatusFilterState] = useState('ALL')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Cheque[]>([])
  const [total, setTotal] = useState(0)
  const [fetchStatus, setFetchStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setFetchStatus('loading')
    listCheques(page, statusFilter, controller.signal)
      .then((res) => { setItems(res.items); setTotal(res.total); setFetchStatus('success') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchStatus('error')
        toast.error(err instanceof ApiError ? err.message : 'Failed to load cheques')
      })
    return () => controller.abort()
  }, [page, statusFilter, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])
  const setStatusFilter = useCallback((s: string) => { setStatusFilterState(s); setPage(1) }, [])

  return { items, total, page, status: fetchStatus, statusFilter, setStatusFilter, setPage, refresh }
}
