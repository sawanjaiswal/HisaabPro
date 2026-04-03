/** POS Barcode Lookup -- Fetch product by barcode/search (TanStack Query mutation) */

import { useMutation } from '@tanstack/react-query'
import { useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'

import type { QuickProduct } from './pos.types'

const LOOKUP_COOLDOWN_MS = 300

export function useBarcodeLookup(onFound: (product: QuickProduct) => void) {
  const lastLookupRef = useRef(0)
  const toast = useToast()
  const { t } = useLanguage()

  const mutation = useMutation({
    mutationFn: (code: string) =>
      api<QuickProduct>(
        `/products/by-barcode/${encodeURIComponent(code)}`,
      ),
    onSuccess: (product) => {
      onFound(product)
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
