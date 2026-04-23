/** useSubscription — fetch the current business subscription plan & usage */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

export type PlanTier = 'FREE' | 'PRO' | 'BUSINESS'

export interface SubscriptionData {
  plan: PlanTier
  status: 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'TRIALING' | 'NONE'
  expiresAt: string | null
  usage: {
    invoices: { used: number; limit: number }
    users: { used: number; limit: number }
  }
  isTrialing: boolean
}

export function useSubscription() {
  const { user } = useAuth()
  const businessId = user?.businessId

  const query = useQuery<SubscriptionData>({
    queryKey: ['subscription', businessId],
    // api() unwraps the { success, data } envelope — returns SubscriptionData directly.
    queryFn: () => api<SubscriptionData>(`/businesses/${businessId}/subscription`),
    enabled: !!businessId,
    staleTime: 60_000,
  })

  const sub = query.data ?? null

  return {
    subscription: sub,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    plan: (sub?.plan ?? 'FREE') as PlanTier,
    isPro: sub?.plan === 'PRO' || sub?.plan === 'BUSINESS',
    isBusiness: sub?.plan === 'BUSINESS',
    isFree: !sub || sub.plan === 'FREE',
  }
}
