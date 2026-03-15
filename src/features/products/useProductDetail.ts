/** Product Detail — Hook to fetch and manage a single product
 *
 * Mirrors usePartyDetail.ts exactly. Fetches full product by ID,
 * manages tab state, and supports manual refresh via refreshKey.
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
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

  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [status, setStatus] = useState<DetailStatus>('loading')
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    getProduct(id, controller.signal)
      .then((data: ProductDetail) => {
        setProduct(data)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load product'
        toast.error(message)
      })

    return () => controller.abort()
  }, [id, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return {
    product,
    status,
    activeTab,
    setActiveTab,
    refresh,
  }
}
