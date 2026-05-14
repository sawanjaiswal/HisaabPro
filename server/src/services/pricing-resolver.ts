// Pure price resolver — no Prisma imports. Applies the 4-level resolution order:
// manual override → party pricing → tier (qty-break entry) → product sale price.

export interface TierEntry {
  id: string
  mode: 'ABSOLUTE' | 'PERCENT_OFF' | 'FIXED_OFF'
  valuePaise: number | null
  percentBps: number | null
  fixedOffPaise: number | null
  minQty: number
  maxQty: number | null
}

export interface PriceResolverInput {
  manualOverridePaise: number | null
  partyPricing: { price: number; minQty: number } | null
  tier: { entries: TierEntry[] } | null
  productSalePrice: number
  qty: number
}

export interface PriceResolverResult {
  resolvedPaise: number
  source: 'MANUAL' | 'PARTY_PRICING' | 'TIER' | 'PRODUCT_DEFAULT'
  appliedEntryId: string | null
}

function computeEntryPrice(entry: TierEntry, productSalePrice: number): number {
  switch (entry.mode) {
    case 'ABSOLUTE':
      return entry.valuePaise ?? productSalePrice

    case 'PERCENT_OFF': {
      const bps = entry.percentBps ?? 0
      // 10000 bps = 100%; price = salePrice * (10000 - bps) / 10000
      return Math.max(0, Math.round((productSalePrice * (10000 - bps)) / 10000))
    }

    case 'FIXED_OFF': {
      const discount = entry.fixedOffPaise ?? 0
      return Math.max(0, productSalePrice - discount)
    }
  }
}

export function resolvePrice(input: PriceResolverInput): PriceResolverResult {
  const { manualOverridePaise, partyPricing, tier, productSalePrice, qty } = input

  // Level 1 — manual override (null-check: 0 is a valid override price)
  if (manualOverridePaise !== null && manualOverridePaise !== undefined) {
    return { resolvedPaise: manualOverridePaise, source: 'MANUAL', appliedEntryId: null }
  }

  // Level 2 — party pricing (if qty meets minimum)
  if (partyPricing !== null && qty >= partyPricing.minQty) {
    return { resolvedPaise: partyPricing.price, source: 'PARTY_PRICING', appliedEntryId: null }
  }

  // Level 3 — tier qty-break entry
  if (tier !== null && tier.entries.length > 0) {
    const matching = tier.entries.filter(
      (e) => e.minQty <= qty && (e.maxQty === null || e.maxQty >= qty),
    )

    if (matching.length > 0) {
      // Most specific band = highest minQty among matches
      const best = matching.reduce((prev, curr) => (curr.minQty > prev.minQty ? curr : prev))
      return {
        resolvedPaise: computeEntryPrice(best, productSalePrice),
        source: 'TIER',
        appliedEntryId: best.id,
      }
    }
  }

  // Level 4 — product sale price fallback
  return { resolvedPaise: productSalePrice, source: 'PRODUCT_DEFAULT', appliedEntryId: null }
}
