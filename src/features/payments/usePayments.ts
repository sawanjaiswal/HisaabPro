/** Payments — List hook
 *
 * Manages paginated payment list, debounced search, filter state, and
 * optimistic delete with undo toast. Mirrors useInvoices.ts pattern exactly.
 * All amounts in PAISE.
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { TIMEOUTS } from '@/config/app.config'
import { DEFAULT_PAYMENT_FILTERS } from './payment.constants'
import { getPayments, deletePayment } from './payment.service'
import type {
  PaymentListResponse,
  PaymentFilters,
  PaymentType,
} from './payment.types'

type Status = 'loading' | 'error' | 'success'

interface UsePaymentsOptions {
  /** Pre-set direction filter. When omitted the list shows all payment types. */
  type?: PaymentType
  initialFilters?: Partial<PaymentFilters>
}

interface UsePaymentsReturn {
  data: PaymentListResponse | null
  status: Status
  filters: PaymentFilters
  setSearch: (term: string) => void
  setFilter: <K extends keyof PaymentFilters>(key: K, value: PaymentFilters[K]) => void
  setPage: (page: number) => void
  refresh: () => void
  handleDelete: (id: string, paymentLabel: string) => void
}

export function usePayments({
  type,
  initialFilters,
}: UsePaymentsOptions = {}): UsePaymentsReturn {
  const toast = useToast()

  const [filters, setFilters] = useState<PaymentFilters>({
    ...DEFAULT_PAYMENT_FILTERS,
    ...(type !== undefined ? { type } : {}),
    ...initialFilters,
  })
  const [data, setData] = useState<PaymentListResponse | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch payments whenever filters or refreshKey change
  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    getPayments(filters, controller.signal)
      .then((response: PaymentListResponse) => {
        setData(response)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load payments'
        toast.error(message)
      })

    return () => controller.abort()
  }, [filters, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search — holds the raw input, effect fires API after 300ms idle
  const [pendingSearch, setPendingSearch] = useState<string | null>(null)

  const setSearch = useCallback((term: string) => {
    setPendingSearch(term)
  }, [])

  useEffect(() => {
    if (pendingSearch === null) return
    const timerId = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: pendingSearch, page: 1 }))
      setPendingSearch(null)
    }, TIMEOUTS.debounceMs)
    return () => clearTimeout(timerId)
  }, [pendingSearch])

  const setFilter = useCallback(<K extends keyof PaymentFilters>(
    key: K,
    value: PaymentFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }, [])

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const handleDelete = useCallback((id: string, paymentLabel: string) => {
    // Optimistic removal from list
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        payments: prev.payments.filter((p) => p.id !== id),
        pagination: {
          ...prev.pagination,
          total: prev.pagination.total - 1,
        },
      }
    })

    let undone = false

    toast.success(`${paymentLabel} deleted`, {
      onUndo: () => {
        undone = true
        refresh()
      },
      undoLabel: 'Undo',
    })

    // Delay actual deletion to allow undo window (matches toast duration)
    const timerId = setTimeout(() => {
      if (undone) return
      deletePayment(id).catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : 'Failed to delete payment'
        toast.error(message)
        refresh() // Restore list on failure
      })
    }, 5_000)

    // Cleanup on unmount is not needed here — timer is self-contained
    // and a leaked delete after unmount is safe (server state corrects on next fetch)
    void timerId
  }, [refresh, toast])

  return {
    data,
    status,
    filters,
    setSearch,
    setFilter,
    setPage,
    refresh,
    handleDelete,
  }
}
