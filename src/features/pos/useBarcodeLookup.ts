/** POS Barcode Lookup — Fetch product by barcode, with offline IDB fallback */

import { useMutation } from '@tanstack/react-query'
import { useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { readApiCache } from '@/lib/api-cache'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'

import type { QuickProduct } from './pos.types'

const LOOKUP_COOLDOWN_MS = 300

/** Where a code came from — a trigger pull, or the camera's continuous decode. */
export type LookupSource = 'manual' | 'camera'

// ─── Offline cache lookup ─────────────────────────────────────────────────────
// The API cache stores full product list responses keyed by URL.
// When offline, we iterate through cached product list pages to find a
// barcode match. This covers the common case where products were loaded
// at least once during the session.
async function lookupProductOffline(code: string): Promise<QuickProduct | null> {
  // Try common paginated product list cache entries
  for (let page = 1; page <= 10; page++) {
    const key = `/products?page=${page}&limit=50&status=ACTIVE`
    type ListShape = { products: Array<QuickProduct & { barcode?: string }> }
    const cached = await readApiCache<ListShape>(key)
    if (!cached?.products) break
    const found = cached.products.find((p) => p.barcode === code)
    if (found) return found
    // If fewer products than limit, no more pages
    if (cached.products.length < 50) break
  }
  // Also try without pagination params
  const simpleKey = '/products?status=ACTIVE'
  type SimpleShape = { products: Array<QuickProduct & { barcode?: string }> }
  const simple = await readApiCache<SimpleShape>(simpleKey)
  if (simple?.products) {
    const found = simple.products.find((p) => p.barcode === code)
    if (found) return found
  }
  return null
}

export function useBarcodeLookup(onFound: (product: QuickProduct) => void) {
  const lastLookupRef = useRef(0)
  const lastCodeRef = useRef<string | null>(null)
  const toast = useToast()
  const { t } = useLanguage()

  const mutation = useMutation({
    mutationFn: async (code: string) => {
      // Offline branch: query IDB cache first
      if (!navigator.onLine) {
        const cached = await lookupProductOffline(code)
        if (cached) return cached
        throw new Error('You\'re offline — product not in local cache.')
      }
      // Online branch: hit the API. The route wraps in { product } —
      // see server/src/routes/products/bulk.ts.
      const { product } = await api<{ product: QuickProduct | null }>(
        `/products/by-barcode/${encodeURIComponent(code)}`,
      )
      if (!product) throw new Error(t.productNotFound)
      return product
    },
    onSuccess: (product) => {
      onFound(product)
      if (!navigator.onLine) {
        toast.success('Saved — will sync when online')
      }
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : t.productNotFound)
    },
  })

  /**
   * `source` decides whether a repeat is an echo or a sale.
   *
   * The cooldown used to drop ANY code within 300ms of the last one. At a
   * counter that is silent item loss twice over: a cashier working the belt
   * fast loses different items, and — worse, because it is the common case —
   * two units of the same SKU (two bottles of milk, both scanned in one motion)
   * bill as one, with no toast, no beep, nothing. The customer is undercharged
   * and the stock is wrong.
   *
   * A deliberate scan is always a sale. Only the camera, which decodes the same
   * label continuously while it is pointed at it, can produce an echo — so the
   * guard now lives where the repeats actually come from.
   */
  const lookup = useCallback((code: string, source: LookupSource = 'manual') => {
    const now = Date.now()
    if (
      source === 'camera' &&
      lastCodeRef.current === code &&
      now - lastLookupRef.current < LOOKUP_COOLDOWN_MS
    ) {
      return
    }
    lastLookupRef.current = now
    lastCodeRef.current = code
    mutation.mutate(code)
  }, [mutation])

  return { searching: mutation.isPending, lookup }
}
