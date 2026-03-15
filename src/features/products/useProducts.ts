/** Products — List hook
 *
 * Mirrors useParties.ts exactly. Manages paginated product list,
 * debounced search, filter state, optimistic delete with undo toast,
 * and manual refresh via refreshKey.
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { TIMEOUTS } from '@/config/app.config'
import { DEFAULT_PRODUCT_FILTERS } from './product.constants'
import { getProducts, createProduct, deleteProduct } from './product.service'
import type { ProductListResponse, ProductFilters, ProductFormData } from './product.types'

type Status = 'loading' | 'error' | 'success'

interface UseProductsOptions {
  initialFilters?: Partial<ProductFilters>
}

interface UseProductsReturn {
  data: ProductListResponse | null
  status: Status
  filters: ProductFilters
  setSearch: (term: string) => void
  setFilter: <K extends keyof ProductFilters>(key: K, value: ProductFilters[K]) => void
  setPage: (page: number) => void
  refresh: () => void
  handleCreate: (formData: ProductFormData) => Promise<void>
  handleDelete: (id: string, name: string) => void
}

export function useProducts({ initialFilters }: UseProductsOptions = {}): UseProductsReturn {
  const toast = useToast()

  const [filters, setFilters] = useState<ProductFilters>({
    ...DEFAULT_PRODUCT_FILTERS,
    status: 'ACTIVE',
    ...initialFilters,
  })
  const [data, setData] = useState<ProductListResponse | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch products whenever filters or refreshKey change
  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    getProducts(filters, controller.signal)
      .then((response: ProductListResponse) => {
        setData(response)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load products'
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

  const setFilter = useCallback(<K extends keyof ProductFilters>(key: K, value: ProductFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }, [])

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const handleCreate = useCallback(async (formData: ProductFormData) => {
    try {
      await createProduct(formData)
      toast.success(`${formData.name} added successfully`)
      refresh()
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Failed to create product'
      toast.error(message)
      throw err
    }
  }, [refresh, toast])

  const handleDelete = useCallback((id: string, name: string) => {
    // Optimistic removal from list
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        products: prev.products.filter((p) => p.id !== id),
        pagination: {
          ...prev.pagination,
          total: prev.pagination.total - 1,
        },
      }
    })

    let undone = false

    toast.success(`${name} deleted`, {
      onUndo: () => {
        undone = true
        refresh()
      },
      undoLabel: 'Undo',
    })

    // Delay actual deletion to allow undo window (matches toast duration)
    const timerId = setTimeout(() => {
      if (undone) return
      deleteProduct(id).catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : 'Failed to delete product'
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
    handleCreate,
    handleDelete,
  }
}
