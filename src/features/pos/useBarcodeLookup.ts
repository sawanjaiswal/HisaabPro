/** POS Barcode Lookup — Fetch product by barcode/search */

import { useState, useRef, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'

import type { QuickProduct } from './pos.types'

const LOOKUP_COOLDOWN_MS = 300

export function useBarcodeLookup(onFound: (product: QuickProduct) => void) {
  const [searching, setSearching] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const lastLookupRef = useRef(0)
  const toast = useToast()
  const { t } = useLanguage()

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const lookup = useCallback(async (code: string) => {
    const now = Date.now()
    if (now - lastLookupRef.current < LOOKUP_COOLDOWN_MS) return
    lastLookupRef.current = now

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setSearching(true)
    try {
      const product = await api<QuickProduct>(
        `/products/by-barcode/${encodeURIComponent(code)}`,
        { signal: ctrl.signal },
      )
      onFound(product)
    } catch (err) {
      if (!ctrl.signal.aborted) {
        // TODO: structured log — barcode.lookup.failed {code, error}
        toast.error(err instanceof Error ? err.message : t.productNotFound)
      }
    } finally {
      if (!ctrl.signal.aborted) setSearching(false)
    }
  }, [onFound, toast])

  return { searching, lookup }
}
