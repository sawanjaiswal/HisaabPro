/** Product Detail — Hook to fetch and manage a single product
 *
 * TanStack Query v5 migration. Fetches full product by ID,
 * manages tab state. Query replaces useState + useEffect + refreshKey.
 */

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { getProduct } from './product.service'
import type { ProductDetail } from './product.types'

type DetailStatus = 'loading' | 'error' | 'success'
type DetailTab = 'overview' | 'stock' | 'info'

interface UseProductDetailReturn {
  product: ProductDetail | null
  status: DetailStatus
  activeTab: DetailTab
  setActiveTab: (tab: DetailTab) => void
  refresh: () => void
}

export function useProductDetail(id: string): UseProductDetailReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<DetailTab>('overview')

  // TanStack Query replaces useState(product) + useEffect(fetch) + refreshKey
  const query = useQuery({
    queryKey: queryKeys.products.detail(id),
    queryFn: ({ signal }) => getProduct(id, signal),
  })

  const product = query.data ?? null
  const status: DetailStatus = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load product'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(id) })
  }, [queryClient, id])

  return {
    product,
    status,
    activeTab,
    setActiveTab,
    refresh,
  }
}
