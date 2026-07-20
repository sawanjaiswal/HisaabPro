/** Stock Adjustments — API service layer (mockup #48). */

import { api } from '@/lib/api'
import type { StockAdjustmentListResponse, AdjustmentDirection } from './adjustments.types'

interface StockAdjustmentQuery {
  cursor?: string
  limit?: number
  search?: string
  direction?: AdjustmentDirection
}

/**
 * Fetch the business-wide manual adjustment log, newest first.
 * Not cached: an adjustment made on another device should show up on the next
 * visit, and the log is not something to read offline.
 */
export async function getStockAdjustments(
  query: StockAdjustmentQuery = {},
  signal?: AbortSignal,
): Promise<StockAdjustmentListResponse> {
  const params = new URLSearchParams()
  if (query.cursor) params.set('cursor', query.cursor)
  if (query.limit !== undefined) params.set('limit', String(query.limit))
  if (query.search) params.set('search', query.search)
  if (query.direction) params.set('direction', query.direction)

  const qs = params.toString()
  return api<StockAdjustmentListResponse>(
    `/products/stock/adjustments${qs ? `?${qs}` : ''}`,
    { signal },
  )
}
