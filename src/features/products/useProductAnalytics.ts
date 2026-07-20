/** Product Detail — analytics hook (sales metrics, stock summary, stat tiles).
 *
 * Separate query from useProductDetail so the identity card renders instantly
 * while the heavier aggregation loads. Degrades silently: on error the caller
 * shows zeros rather than blocking the page.
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { getProductAnalytics } from './product-analytics.service'
import type { ProductAnalytics } from './product-analytics.types'

interface UseProductAnalyticsReturn {
  analytics: ProductAnalytics | null
  isLoading: boolean
  isError: boolean
}

export function useProductAnalytics(id: string): UseProductAnalyticsReturn {
  const query = useQuery({
    queryKey: queryKeys.products.analytics(id),
    queryFn: ({ signal }) => getProductAnalytics(id, signal),
    enabled: Boolean(id),
    staleTime: 60_000,
  })

  return {
    analytics: query.data ?? null,
    isLoading: query.isPending,
    isError: query.isError,
  }
}
