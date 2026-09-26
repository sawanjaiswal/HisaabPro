import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { TIMEOUTS } from '@/config/app.config'
import { DEFAULT_PAYMENT_FILTERS } from './payment.constants'
import { getPayments, deletePayment } from './payment.service'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { PaymentRepository } from '@/repositories/payment.repository'
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

  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())

  // 0ms Live Query with automatic fallback to getPayments service
  const {
    data: rawData,
    isLoading,
    error,
    refetch,
  } = useLiveQuery(
    ['payments', filters.page, filters.limit, filters.search, filters.type, filters.mode],
    async () => {
      try {
        const repo = new PaymentRepository()
        const local = await repo.list(filters)
        if (local.payments.length > 0) {
          return local
        }
      } catch {}
      return getPayments(filters)
    }
  )

  // Apply optimistic deletions
  const data = useMemo<PaymentListResponse | null>(() => {
    if (!rawData) return null
    const filteredPayments = rawData.payments.filter((p) => !removedIds.has(p.id))
    const removedCount = rawData.payments.length - filteredPayments.length
    return {
      payments: filteredPayments,
      pagination: {
        ...rawData.pagination,
        total: Math.max(0, rawData.pagination.total - removedCount),
      },
      summary: rawData.summary,
    }
  }, [rawData, removedIds])

  const status: Status = isLoading && !data ? 'loading' : error ? 'error' : 'success'

  // Show toast on fetch error
  const prevErrorRef = useRef<Error | null>(null)
  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      prevErrorRef.current = error
      const message = error instanceof ApiError ? error.message : 'Failed to load payments'
      toast.error(message)
    }
  }, [error, toast])

  // Debounced search
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

  const setFilter = useCallback(<K extends keyof PaymentFilters>(key: K, value: PaymentFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }, [])

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const refresh = useCallback(() => {
    refetch()
  }, [refetch])

  // <1ms Optimistic Delete with undo window
  const handleDelete = useCallback((id: string, paymentLabel: string) => {
    let undone = false
    setRemovedIds((prev) => new Set(prev).add(id))

    toast.success(`${paymentLabel} deleted`, {
      onUndo: () => {
        undone = true
        setRemovedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        refetch()
      },
      undoLabel: 'Undo',
    })

    setTimeout(() => {
      if (undone) return
      deletePayment(id)
        .then(() => refetch())
        .catch((err: any) => {
          setRemovedIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
          const message = err instanceof ApiError ? err.message : 'Failed to delete payment'
          toast.error(message)
          refetch()
        })
    }, 5_000)
  }, [refetch, toast])

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
