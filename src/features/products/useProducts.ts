/** Products — List hook
 *
 * TanStack Query v5 migration. Manages paginated product list,
 * debounced search, filter state, optimistic delete with undo toast.
 * Query replaces useState(data) + useEffect(fetch) + refreshKey.
 */

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState<ProductFilters>({
    ...DEFAULT_PRODUCT_FILTERS,
    status: 'ACTIVE',
    ...initialFilters,
  })

  // TanStack Query replaces useState(data) + useEffect(fetch) + refreshKey
  const query = useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: ({ signal }) => getProducts(filters, signal),
  })

  const data = query.data ?? null
  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load products'
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

  const setFilter = useCallback(<K extends keyof ProductFilters>(key: K, value: ProductFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }, [])

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all() })
  }, [queryClient])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (formData: ProductFormData) => createProduct(formData),
    onSuccess: (_result, formData) => {
      toast.success(`${formData.name} added successfully`)
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all() })
    },
    onError: (err: Error) => {
      const message = err instanceof ApiError ? err.message : 'Failed to create product'
      toast.error(message)
    },
  })

  const handleCreate = useCallback(async (formData: ProductFormData) => {
    await createMutation.mutateAsync(formData)
  }, [createMutation])

  // Delete with undo (keeps existing UX: delay actual delete for 5s undo window)
  const handleDelete = useCallback((id: string, name: string) => {
    // Optimistic: update cache directly
    queryClient.setQueryData<ProductListResponse>(
      queryKeys.products.list(filters),
      (old) => {
        if (!old) return old
        return {
          ...old,
          products: old.products.filter((p) => p.id !== id),
          pagination: { ...old.pagination, total: old.pagination.total - 1 },
        }
      }
    )

    let undone = false

    toast.success(`${name} deleted`, {
      onUndo: () => {
        undone = true
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all() })
      },
      undoLabel: 'Undo',
    })

    setTimeout(() => {
      if (undone) return
      deleteProduct(id).catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : 'Failed to delete product'
        toast.error(message)
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all() })
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
    handleCreate,
    handleDelete,
  }
}
