/** useProductPricePreview — fetches price-list preview for a single product.
 *
 * Hits GET /api/products/:id/price-preview (Batch 3, #132).
 * Returns one row per price list that has this product in scope, with
 * per-tier entries and a resolved paise value at qty=1.
 *
 * Cached 60 s; refetches on window focus so the panel stays fresh after
 * a list edit in a sibling tab.
 */

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ─── Shapes (mirrors the API response from Batch 3) ───────────────────────────

export interface PricePreviewEntry {
  entryId: string
  minQty: number
  maxQty: number | null
  mode: 'ABSOLUTE' | 'PERCENT_OFF' | 'FIXED_OFF'
  percentBps: number | null
  resolvedPaiseAtQty1: number
  source: 'TIER' | 'PARTY_PRICING' | 'PRODUCT_DEFAULT'
}

export interface PricePreviewList {
  priceListId: string
  listName: string
  isDefault: boolean
  /** Present when the list has entries for this product */
  entries?: PricePreviewEntry[]
}

// ─── Query key ────────────────────────────────────────────────────────────────

export const productPricePreviewKey = (productId: string) =>
  ['products', 'price-preview', productId] as const

// ─── Fetcher ──────────────────────────────────────────────────────────────────

async function fetchProductPricePreview(
  productId: string,
  signal?: AbortSignal,
): Promise<PricePreviewList[]> {
  const res = await api<{ preview: PricePreviewList[] }>(
    `/products/${productId}/price-preview`,
    { signal, cacheReads: true },
  )
  return res.preview
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseProductPricePreviewReturn {
  preview: PricePreviewList[]
  status: 'loading' | 'error' | 'success'
  refetch: () => void
}

export function useProductPricePreview(productId: string): UseProductPricePreviewReturn {
  const query = useQuery({
    queryKey: productPricePreviewKey(productId),
    queryFn: ({ signal }) => fetchProductPricePreview(productId, signal),
    enabled: Boolean(productId),
    staleTime: 60 * 1000,       // 60 s
    refetchOnWindowFocus: true,
  })

  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return {
    preview: query.data ?? [],
    status,
    refetch: query.refetch,
  }
}
