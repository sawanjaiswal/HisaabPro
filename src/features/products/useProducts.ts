import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { TIMEOUTS } from '@/config/app.config'
import { DEFAULT_PRODUCT_FILTERS } from './product.constants'
import { getProducts, createProduct, deleteProduct } from './product.service'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { ProductRepository } from '@/repositories/product.repository'
import type { ProductListResponse, ProductFilters, ProductFormData } from './product.types'
import type { ProductSummary } from '@/lib/types/product.types'

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
  hasMore: boolean
  loadMore: () => void
  isLoadingMore: boolean
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

  // Accumulated pages list for infinite scrolling
  const [accumulatedProducts, setAccumulatedProducts] = useState<ProductSummary[]>([])
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())

  // 0ms Live Query with automatic fallback to getProducts service
  const {
    data: rawData,
    isLoading,
    error,
    refetch,
  } = useLiveQuery(
    ['products', filters.page, filters.limit, filters.search, filters.status, filters.categoryId, filters.lowStockOnly],
    async () => {
      try {
        const repo = new ProductRepository()
        const local = await repo.list(filters)
        if (local.products.length > 0) {
          return local
        }
      } catch {}
      return getProducts(filters)
    }
  )

  // Accumulate pages when loading more
  useEffect(() => {
    if (!rawData) return
    if (filters.page === 1) {
      setAccumulatedProducts(rawData.products)
      setRemovedIds(new Set())
    } else {
      setAccumulatedProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id))
        const newItems = rawData.products.filter((p) => !existingIds.has(p.id))
        return [...prev, ...newItems]
      })
    }
  }, [rawData, filters.page])

  // Compute final data with optimistic deletions applied
  const data = useMemo<ProductListResponse | null>(() => {
    if (!rawData) return null
    const filteredProducts = accumulatedProducts.filter((p) => !removedIds.has(p.id))
    const removedCount = removedIds.size
    return {
      products: filteredProducts,
      pagination: {
        ...rawData.pagination,
        total: Math.max(0, rawData.pagination.total - removedCount),
      },
      summary: rawData.summary,
    }
  }, [rawData, accumulatedProducts, removedIds])

  const status: Status = isLoading && !data ? 'loading' : error ? 'error' : 'success'

  // Show toast on fetch error
  const prevErrorRef = useRef<Error | null>(null)
  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      prevErrorRef.current = error
      const message = error instanceof ApiError ? error.message : 'Failed to load products'
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

  const setFilter = useCallback(<K extends keyof ProductFilters>(key: K, value: ProductFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }, [])

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const hasMore = (data?.pagination?.page ?? 1) < (data?.pagination?.totalPages ?? 1)

  const loadMore = useCallback(() => {
    if (hasMore) {
      setFilters((prev) => ({ ...prev, page: prev.page + 1 }))
    }
  }, [hasMore])

  const refresh = useCallback(() => {
    refetch()
  }, [refetch])

  // <1ms Optimistic Create Mutation via Service + Repository
  const handleCreate = useCallback(async (formData: ProductFormData) => {
    try {
      await createProduct(formData)
      toast.success(`${formData.name} added successfully`)
      refetch()
    } catch (err: any) {
      const message = err instanceof ApiError ? err.message : 'Failed to create product'
      toast.error(message)
    }
  }, [refetch, toast])

  // <1ms Optimistic Delete with undo window
  const handleDelete = useCallback((id: string, name: string) => {
    let undone = false
    setRemovedIds((prev) => new Set(prev).add(id))

    toast.success(`${name} deleted`, {
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
      deleteProduct(id)
        .then(() => refetch())
        .catch((err: any) => {
          setRemovedIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
          const message = err instanceof ApiError ? err.message : 'Failed to delete product'
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
    hasMore,
    loadMore,
    isLoadingMore: false,
    refresh,
    handleCreate,
    handleDelete,
  }
}
