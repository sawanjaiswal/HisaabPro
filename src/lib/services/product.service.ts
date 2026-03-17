/** Shared product service — search function used by invoices */

import { api } from '@/lib/api'
import type { ProductSummary } from '@/lib/types/product.types'

interface ProductSearchParams {
  search?: string
  limit?: number
  page?: number
}

interface ProductSearchResponse {
  products: ProductSummary[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Search products by name/SKU — thin wrapper used by ProductSearchInput.
 * For full product CRUD, use the feature-specific product.service.
 */
export async function getProducts(
  filters: ProductSearchParams = {},
  signal?: AbortSignal
): Promise<ProductSearchResponse> {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.limit !== undefined) params.set('limit', String(filters.limit))
  if (filters.page !== undefined) params.set('page', String(filters.page))
  const qs = params.toString()
  return api<ProductSearchResponse>(`/products${qs ? `?${qs}` : ''}`, { signal })
}
