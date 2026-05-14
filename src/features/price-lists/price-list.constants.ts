/** Price List feature — constants, labels, helpers */

import type { PriceListMode } from './price-list.types'

// ─── Mode labels ──────────────────────────────────────────────────────────────

export const MODE_LABELS: Record<PriceListMode, string> = {
  ABSOLUTE:    'Fixed Price',
  PERCENT_OFF: '% Off',
  FIXED_OFF:   'Flat Off',
}

export const MODE_DESCRIPTIONS: Record<PriceListMode, string> = {
  ABSOLUTE:    'Set a specific price for this product',
  PERCENT_OFF: 'Discount by a percentage off the sale price',
  FIXED_OFF:   'Subtract a fixed amount from the sale price',
}

export const PRICE_LIST_MODES: PriceListMode[] = ['ABSOLUTE', 'PERCENT_OFF', 'FIXED_OFF']

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PRICE_LIST_PAGE_LIMIT = 20

// ─── Basis-point helpers ──────────────────────────────────────────────────────

/** User-visible percent string → basis points (e.g. "15.5" → 1550) */
export function percentToBps(displayStr: string): number {
  const val = parseFloat(displayStr)
  if (isNaN(val)) return 0
  return Math.round(val * 100)
}

/** Basis points → user-visible percent string (e.g. 1550 → "15.5") */
export function bpsToPercent(bps: number): string {
  const pct = bps / 100
  return pct % 1 === 0 ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, '')
}

// ─── Qty-band label ───────────────────────────────────────────────────────────

/** Returns a readable qty-band label like "10 – 99" or "10+" */
export function qtyBandLabel(minQty: number, maxQty: number | null): string {
  if (maxQty === null) return `${minQty}+`
  return `${minQty} – ${maxQty}`
}
