/** useLinePriceMeta — tracks per-line priceMode + salePrice state.
 *
 * Extracted from InvoiceItemsSection to keep that file within the 250-line limit.
 * Handles: initial state, length sync (add/remove), productId reset, party change re-resolve.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { resolvePrice } from '@/features/price-lists/pricing-resolver'
import type { PriceListDetail } from '@/features/price-lists/price-list.types'
import type { LineItemFormData } from '../invoice.types'

export type PriceMode = 'AUTO' | 'EDITED'

export interface LinePriceMeta {
  mode: PriceMode
  salePrice: number
}

interface UseLinePriceMetaOptions {
  lineItems: LineItemFormData[]
  partyId: string
  isEditMode: boolean
  tier: PriceListDetail | null
  partyPricing: Record<string, { price: number; minQty: number }> | null
  onUpdateLineItem: (index: number, updates: Partial<LineItemFormData>) => void
}

interface UseLinePriceMetaReturn {
  lineMeta: LinePriceMeta[]
  handlePriceModeChange: (index: number, mode: PriceMode) => void
  appendMeta: (salePrice: number) => void
}

export function useLinePriceMeta({
  lineItems,
  partyId,
  isEditMode,
  tier,
  partyPricing,
  onUpdateLineItem,
}: UseLinePriceMetaOptions): UseLinePriceMetaReturn {
  const [lineMeta, setLineMeta] = useState<LinePriceMeta[]>(() =>
    lineItems.map(() => ({ mode: isEditMode ? 'EDITED' : 'AUTO', salePrice: 0 })),
  )

  // Sync when lines shrink (removals) or grow via scan-import
  const prevLengthRef = useRef(lineItems.length)
  useEffect(() => {
    const prev = prevLengthRef.current
    const curr = lineItems.length
    prevLengthRef.current = curr

    if (curr < prev) {
      setLineMeta((m) => m.slice(0, curr))
    } else if (curr > prev) {
      setLineMeta((m) => {
        const deficit = curr - m.length
        if (deficit <= 0) return m
        return [
          ...m,
          ...Array.from({ length: deficit }, () => ({
            mode: isEditMode ? ('EDITED' as PriceMode) : ('AUTO' as PriceMode),
            salePrice: 0,
          })),
        ]
      })
    }
  }, [lineItems.length, isEditMode])

  // Re-resolve AUTO lines when party changes
  const prevPartyRef = useRef(partyId)
  useEffect(() => {
    if (prevPartyRef.current === partyId) return
    prevPartyRef.current = partyId

    lineItems.forEach((item, index) => {
      const meta = lineMeta[index]
      if (!meta || meta.mode !== 'AUTO') return

      const entries = tier?.entries.filter((e) => e.productId === item.productId) ?? []
      const tierInput = entries.length > 0 ? { entries } : null
      const ppOverride = partyPricing?.[item.productId] ?? null

      const resolved = resolvePrice({
        manualOverridePaise: null,
        partyPricing: ppOverride,
        tier: tierInput,
        productSalePrice: meta.salePrice || item.rate,
        qty: item.quantity,
      })

      if (resolved.resolvedPaise !== item.rate) {
        onUpdateLineItem(index, { rate: resolved.resolvedPaise })
      }
    })
  }, [partyId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePriceModeChange = useCallback((index: number, mode: PriceMode) => {
    setLineMeta((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], mode }
      return next
    })
  }, [])

  const appendMeta = useCallback((salePrice: number) => {
    setLineMeta((prev) => [...prev, { mode: 'AUTO', salePrice }])
  }, [])

  return { lineMeta, handlePriceModeChange, appendMeta }
}
