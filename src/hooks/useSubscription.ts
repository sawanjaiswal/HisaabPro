/** useSubscription — fetch the current business subscription plan & usage */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import type { PlanTier } from '@/features/subscription/plan-limits'
import type {
  SubscriptionData,
  SubscriptionState,
} from '@/features/subscription/subscription.types'

// Re-export for back-compat with existing imports.
export type { PlanTier }
export type { SubscriptionData }

export function useSubscription() {
  const { user } = useAuth()
  const businessId = user?.businessId

  const query = useQuery<SubscriptionData>({
    queryKey: ['subscription', businessId],
    // api() unwraps the { success, data } envelope — returns SubscriptionData directly.
    // cacheReads: safe (status-only data, no per-row PII) and the entitlement
    // JWT is the offline source-of-truth anyway.
    queryFn: () =>
      api<SubscriptionData>(`/businesses/${businessId}/subscription`, {
        cacheReads: true,
      }),
    enabled: !!businessId,
    staleTime: 60_000,
  })

  const sub = query.data ?? null
  const state: SubscriptionState = sub?.state ?? 'NONE'

  const graceUntilDate = sub?.graceUntil ? new Date(sub.graceUntil) : null
  const isInGrace =
    state === 'PAST_DUE' && graceUntilDate !== null && graceUntilDate.getTime() > Date.now()
  const isLocked = state === 'LOCKED'

  return {
    subscription: sub,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    plan: (sub?.plan ?? 'FREE') as PlanTier,
    state,
    graceUntil: graceUntilDate,
    isInGrace,
    isLocked,
    mandate: sub?.mandate ?? null,
    addons: sub?.addons ?? [],
    offlineToken: sub?.offlineToken ?? null,
    isPro: sub?.plan === 'PRO' || sub?.plan === 'BUSINESS' || sub?.plan === 'PRO_MAX',
    isBusiness: sub?.plan === 'BUSINESS' || sub?.plan === 'PRO_MAX',
    isFree: !sub || sub.plan === 'FREE',
  }
}
