/** usePriceListOverride — per-document price-list override hook (Epic B PR2).
 *
 * Manages the override selector state:
 *   IDLE (party default) → APPLIED (explicit override) → IDLE (reset)
 *
 * Resolution order:
 *   Document.priceListId override → Party.priceListId default → null
 *
 * All API calls via api(). Price list list is cached (cacheReads: true)
 * because it is PII-safe static reference data within a session.
 */

import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { PriceList, PriceListDetail } from '@/features/price-lists/price-list.types'
import { getPriceList, listPriceLists } from '@/features/price-lists/price-list.service'
import { priceListKeys } from '@/features/price-lists/price-list-queries'

// ─── Selector state ───────────────────────────────────────────────────────────

/** Internal state machine: idle = party default, applied = explicit override */
export type OverrideState = 'idle' | 'applied'

// ─── Hook options ─────────────────────────────────────────────────────────────

export interface UsePriceListOverrideOptions {
  /** The party's assigned price list id (from party detail, may be null) */
  partyDefaultListId: string | null
  /** Initial override id from existing document (edit mode) */
  initialOverrideId?: string | null
  /** Called whenever the effective override id changes (drives form state) */
  onOverrideChange: (priceListId: string | null) => void
}

// ─── Hook return ──────────────────────────────────────────────────────────────

export interface UsePriceListOverrideReturn {
  /** All available price lists for the picker */
  availableLists: PriceList[]
  /** Loading state for the list query */
  listsLoading: boolean
  /** Currently effective price list detail (override or party default) */
  effectiveTier: PriceListDetail | null
  /** The explicitly selected override id; null = falls back to party default */
  selectedListId: string | null
  /** The name to display in the chip — override name or party default name */
  displayName: string | null
  /** True when a user-selected override is active (not just the party default) */
  isOverridden: boolean
  /** Set override; null = reset to party default */
  setOverride: (id: string | null) => void
  /** Clears the override, falls back to party default */
  resetOverride: () => void
  /** The state machine state */
  overrideState: OverrideState
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePriceListOverride({
  partyDefaultListId,
  initialOverrideId = null,
  onOverrideChange,
}: UsePriceListOverrideOptions): UsePriceListOverrideReturn {
  const [selectedListId, setSelectedListId] = useState<string | null>(initialOverrideId)

  // Fetch flat list for the picker
  const listsQuery = useQuery({
    queryKey: ['price-lists', 'all-for-picker'] as const,
    queryFn: ({ signal }) => listPriceLists(1, signal),
    staleTime: 10 * 60 * 1000,
  })
  const availableLists = listsQuery.data ?? []

  // The effective id: explicit override wins, else party default
  const effectiveId = selectedListId ?? partyDefaultListId

  // Fetch full detail of the effective price list (for resolver entries)
  const tierQuery = useQuery({
    queryKey: priceListKeys.detail(effectiveId ?? ''),
    queryFn: ({ signal }) => getPriceList(effectiveId!, signal),
    enabled: Boolean(effectiveId),
    staleTime: 10 * 60 * 1000,
  })

  // Derive display name from the flat list (avoid a separate detail fetch for just the name)
  const displayName = useMemo(() => {
    if (!effectiveId) return null
    return availableLists.find((l) => l.id === effectiveId)?.name ?? null
  }, [effectiveId, availableLists])

  const isOverridden = selectedListId !== null

  const overrideState: OverrideState = isOverridden ? 'applied' : 'idle'

  const setOverride = useCallback(
    (id: string | null) => {
      setSelectedListId(id)
      onOverrideChange(id)
    },
    [onOverrideChange],
  )

  const resetOverride = useCallback(() => {
    setSelectedListId(null)
    onOverrideChange(null)
  }, [onOverrideChange])

  return {
    availableLists,
    listsLoading: listsQuery.isPending,
    effectiveTier: tierQuery.data ?? null,
    selectedListId,
    displayName,
    isOverridden,
    setOverride,
    resetOverride,
    overrideState,
  }
}
