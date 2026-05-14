/** useLineItemResolver — auto-fills rate via pricing-resolver when priceMode = 'AUTO'.
 *
 * Extracted from LineItemEditor to keep that file within the 250-line limit.
 * Returns the currently resolved result (used for source hint display).
 */

import { useEffect, useRef, useCallback } from 'react'
import { resolvePrice } from '@/features/price-lists/pricing-resolver'
import type { PriceResolverResult } from '@/features/price-lists/pricing-resolver'
import type { PriceListDetail } from '@/features/price-lists/price-list.types'
import type { PriceMode } from './useLinePriceMeta'

interface UseLineItemResolverOptions {
  productId: string
  quantity: number
  currentRate: number
  isFree: boolean
  priceMode: PriceMode
  priceTier: PriceListDetail | null
  partyPricing: Record<string, { price: number; minQty: number }> | null
  productSalePrice: number | undefined
  onUpdate: (rate: number) => void
}

interface UseLineItemResolverReturn {
  /** Latest resolved result — used for the source hint in EDITED mode */
  latestResolved: PriceResolverResult
  /** Imperative re-resolve — called from "Reset to auto" handler */
  resolveNow: (qty: number) => PriceResolverResult | null
}

export function useLineItemResolver({
  productId,
  quantity,
  currentRate,
  isFree,
  priceMode,
  priceTier,
  partyPricing,
  productSalePrice,
  onUpdate,
}: UseLineItemResolverOptions): UseLineItemResolverReturn {
  const resolvedRef = useRef<PriceResolverResult>({
    resolvedPaise: currentRate,
    source: 'PRODUCT_DEFAULT',
    appliedEntryId: null,
  })

  const buildInput = useCallback(
    (qty: number, manualOverride: number | null) => {
      const salePricePaise = productSalePrice ?? currentRate
      const entries = priceTier?.entries.filter((e) => e.productId === productId) ?? []
      const tierInput = entries.length > 0 ? { entries } : null
      const ppOverride = partyPricing?.[productId] ?? null

      return resolvePrice({
        manualOverridePaise: manualOverride,
        partyPricing: ppOverride,
        tier: tierInput,
        productSalePrice: salePricePaise,
        qty,
      })
    },
    [productId, currentRate, priceTier, partyPricing, productSalePrice],
  )

  // Auto-fill in AUTO mode whenever productId or qty changes
  useEffect(() => {
    if (priceMode === 'EDITED' || isFree) return

    const resolved = buildInput(quantity, null)
    resolvedRef.current = resolved

    if (resolved.resolvedPaise !== currentRate) {
      onUpdate(resolved.resolvedPaise)
    }
  }, [productId, quantity, priceMode, isFree]) // eslint-disable-line react-hooks/exhaustive-deps

  const resolveNow = useCallback(
    (qty: number): PriceResolverResult | null => {
      const resolved = buildInput(qty, null)
      resolvedRef.current = resolved
      return resolved
    },
    [buildInput],
  )

  // For EDITED mode, compute the "what would auto be" result for the hint
  const latestResolved: PriceResolverResult =
    priceMode === 'EDITED'
      ? buildInput(quantity, currentRate)
      : resolvedRef.current

  return { latestResolved, resolveNow }
}
