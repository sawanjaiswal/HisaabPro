/** POS Barcode Lookup — Fetch product by barcode, with offline IDB fallback */

import { useMutation } from '@tanstack/react-query'
import { useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { readApiCache } from '@/lib/api-cache'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'

import type { QuickProduct } from './pos.types'

const LOOKUP_COOLDOWN_MS = 300

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
      // Online branch: hit the API
      return api<QuickProduct>(
        `/products/by-barcode/${encodeURIComponent(code)}`,
      )
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

  const lookup = useCallback((code: string) => {
    const now = Date.now()
    if (now - lastLookupRef.current < LOOKUP_COOLDOWN_MS) return
    lastLookupRef.current = now
    mutation.mutate(code)
  }, [mutation])

  return { searching: mutation.isPending, lookup }
}
