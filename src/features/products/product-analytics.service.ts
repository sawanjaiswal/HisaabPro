/** Product analytics — API access for the detail page. */

import { api } from '@/lib/api'
import type { ProductAnalytics } from './product-analytics.types'

/**
 * Fetch sales + stock analytics for a product.
 * Read-only aggregation; network-only (numbers carry no cross-session PII risk
 * but change often, so no cache).
 */
export async function getProductAnalytics(
  id: string,
  signal?: AbortSignal
): Promise<ProductAnalytics> {
  return api<ProductAnalytics>(`/products/${id}/analytics`, { signal })
}
