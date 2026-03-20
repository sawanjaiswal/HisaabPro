import { useState, useEffect, useCallback, useRef } from 'react'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { useDebounce } from '@/hooks/useDebounce'
import { SERIAL_PAGE_SIZE } from './serial-number.constants'
import type { SerialListResponse, SerialStatus } from './serial-number.types'

type Status = 'loading' | 'error' | 'success'

interface Filters {
  status: SerialStatus | 'all'
  search: string
}

export function useSerialNumbers(productId: string) {
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const [filters, setFilters] = useState<Filters>({ status: 'all', search: '' })
  const [data, setData] = useState<SerialListResponse | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  const debouncedSearch = useDebounce(filters.search)

  useEffect(() => {
    if (!productId) {
      setData(null)
      setStatus('success')
      return
    }

    const controller = new AbortController()
    setStatus('loading')

    const params = new URLSearchParams({ limit: String(SERIAL_PAGE_SIZE) })
    if (filters.status !== 'all') params.set('status', filters.status)
    if (debouncedSearch) params.set('search', debouncedSearch)

    api<SerialListResponse>(`/serial-numbers/product/${productId}?${params}`, {
      signal: controller.signal,
    })
      .then((res) => { setData(res); setStatus('success') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        toastRef.current.error(err instanceof ApiError ? err.message : 'Failed to load serial numbers')
      })

    return () => controller.abort()
  }, [productId, filters.status, debouncedSearch, refreshKey])

  const setSearch = useCallback((term: string) => {
    setFilters((prev) => ({ ...prev, search: term }))
  }, [])

  const setStatusFilter = useCallback((value: SerialStatus | 'all') => {
    setFilters((prev) => ({ ...prev, status: value }))
  }, [])

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), [])

  return { serials: data?.serialNumbers ?? [], total: data?.total ?? 0, status, refetch, filters, setSearch, setStatusFilter }
}
