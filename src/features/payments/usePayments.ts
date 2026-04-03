/** Payments — List hook
 *
 * TanStack Query v5 migration. Manages paginated payment list,
 * debounced search, filter state, and optimistic delete with undo toast.
 * Query replaces useState(data) + useEffect(fetch) + refreshKey.
 * All amounts in PAISE.
 */

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState<PaymentFilters>({
    ...DEFAULT_PAYMENT_FILTERS,
    ...(type !== undefined ? { type } : {}),
    ...initialFilters,
  })

  // TanStack Query replaces useState(data) + useEffect(fetch) + refreshKey
  const query = useQuery({
    queryKey: queryKeys.payments.list(filters),
    queryFn: ({ signal }) => getPayments(filters, signal),
  })

  const data = query.data ?? null
  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load payments'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

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
    queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() })
  }, [queryClient])

  const handleDelete = useCallback((id: string, paymentLabel: string) => {
    // Optimistic: update cache directly
    queryClient.setQueryData<PaymentListResponse>(
      queryKeys.payments.list(filters),
      (old) => {
        if (!old) return old
        return {
          ...old,
          payments: old.payments.filter((p) => p.id !== id),
          pagination: { ...old.pagination, total: old.pagination.total - 1 },
        }
      }
    )

    let undone = false

    toast.success(`${paymentLabel} deleted`, {
      onUndo: () => {
        undone = true
        queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() })
      },
      undoLabel: 'Undo',
    })

    // Delay actual deletion to allow undo window (matches toast duration)
    setTimeout(() => {
      if (undone) return
      deletePayment(id).catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : 'Failed to delete payment'
        toast.error(message)
        queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() })
      })
    }, 5_000)
  }, [filters, queryClient, toast])

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
