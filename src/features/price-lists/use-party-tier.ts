/** usePartyTier — fetch a party's assigned price list + per-product overrides.
 *
 * Used by the invoice form to drive client-side price resolution without
 * a round-trip per line item.  The price list is cached by id (stable for
 * the lifetime of a billing session); the party detail (which carries
 * .pricing[]) is fetched once and kept in query cache.
 *
 * Resolution order (mirrors pricing-resolver.ts):
 *   MANUAL > PARTY_PRICING > TIER > PRODUCT_DEFAULT
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getPriceList } from './price-list.service'
import { priceListKeys } from './price-list-queries'
import type { PriceListDetail } from './price-list.types'
import type { PartyDetail, PartyPricingItem } from '@/features/parties/party.types'

// ─── Query key for party detail (scoped to this hook) ─────────────────────────

const partyDetailKey = (id: string) => ['parties', 'detail', id] as const

// ─── Party detail fetcher ─────────────────────────────────────────────────────

async function fetchPartyDetail(id: string, signal?: AbortSignal): Promise<PartyDetail> {
  const { party } = await api<{ party: PartyDetail }>(`/parties/${id}`, { signal })
  return party
}

// ─── Return shape ──────────────────────────────────────────────────────────────

export type PartyTierStatus = 'idle' | 'loading' | 'error' | 'success'

export interface UsePartyTierReturn {
  /** The full price-list detail (with entries) for the party's assigned list */
  tier: PriceListDetail | null
  /**
   * Per-product overrides keyed by productId.
   * Derived from PartyDetail.pricing — maps to the resolver's partyPricing shape.
   * NOTE: The backend endpoint GET /parties/:id already returns `.pricing[]`.
   * If the backend does NOT include this field yet, partyPricing will be null.
   */
  partyPricing: Record<string, { price: number; minQty: number }> | null
  status: PartyTierStatus
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePartyTier(partyId: string): UsePartyTierReturn {
  // Step 1 — fetch party detail to get priceListId + pricing overrides
  const partyQuery = useQuery({
    queryKey: partyDetailKey(partyId),
    queryFn: ({ signal }) => fetchPartyDetail(partyId, signal),
    enabled: Boolean(partyId),
    staleTime: 5 * 60 * 1000, // 5 min — party detail rarely changes mid-session
  })

  const partyDetail = partyQuery.data ?? null
  const priceListId = partyDetail?.priceListId ?? null

  // Step 2 — fetch price list detail when we know the id
  const tierQuery = useQuery({
    queryKey: priceListKeys.detail(priceListId ?? ''),
    queryFn: ({ signal }) => getPriceList(priceListId!, signal),
    enabled: Boolean(priceListId),
    staleTime: 10 * 60 * 1000, // 10 min — price list is stable within a session
  })

  // Step 3 — derive partyPricing map from party.pricing[]
  const partyPricing = useMemo<Record<string, { price: number; minQty: number }> | null>(() => {
    if (!partyDetail?.pricing?.length) return null
    const map: Record<string, { price: number; minQty: number }> = {}
    for (const item of partyDetail.pricing as PartyPricingItem[]) {
      // PartyPricingItem.customPrice is in paise; minQty defaults to 1
      map[item.productId] = { price: item.customPrice, minQty: item.minQty ?? 1 }
    }
    return Object.keys(map).length > 0 ? map : null
  }, [partyDetail])

  // ─── Composite status ─────────────────────────────────────────────────────

  const status = useMemo<PartyTierStatus>(() => {
    if (!partyId) return 'idle'
    if (partyQuery.isPending || (priceListId && tierQuery.isPending)) return 'loading'
    if (partyQuery.isError || tierQuery.isError) return 'error'
    return 'success'
  }, [partyId, partyQuery.isPending, partyQuery.isError, priceListId, tierQuery.isPending, tierQuery.isError])

  return {
    tier: tierQuery.data ?? null,
    partyPricing,
    status,
  }
}
