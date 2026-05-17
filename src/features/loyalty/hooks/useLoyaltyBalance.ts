/**
 * Loyalty #125 — Per-party balance hook.
 *
 * Returns `null` data while loading or when partyId is empty/walk-in.
 * Cache key: queryKeys.loyalty.balance(partyId).
 *
 * `enabled` guard:
 *   - skip when no partyId (walk-in / no customer chosen)
 *   - skip when caller explicitly disables (e.g. program turned off)
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { getBalance } from '../api/loyalty.service'
import type { LoyaltyBalanceDTO } from '../loyalty.types'

interface UseLoyaltyBalanceArgs {
  partyId: string | undefined
  enabled?: boolean
}

interface UseLoyaltyBalanceReturn {
  balance: LoyaltyBalanceDTO | null
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

export function useLoyaltyBalance({
  partyId,
  enabled = true,
}: UseLoyaltyBalanceArgs): UseLoyaltyBalanceReturn {
  const isEnabled = Boolean(partyId) && enabled

  const q = useQuery({
    queryKey: partyId
      ? queryKeys.loyalty.balance(partyId)
      : queryKeys.loyalty.balance('__none__'),
    queryFn: () => getBalance(partyId as string),
    enabled: isEnabled,
    staleTime: 15_000,
  })

  return {
    balance: q.data ?? null,
    isLoading: isEnabled && q.isLoading,
    isError: q.isError,
    refetch: () => void q.refetch(),
  }
}
