/** useSubscription — fetch the current business subscription plan & usage */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

interface SubscriptionData {
  plan: 'FREE' | 'PRO' | 'BUSINESS'
  status: 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'TRIALING' | 'NONE'
  expiresAt: string | null
  usage: {
    invoices: { used: number; limit: number }
    users: { used: number; limit: number }
  }
  isTrialing: boolean
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

export function useSubscription() {
  const { user } = useAuth()
  const businessId = user?.businessId

  const query = useQuery<ApiResponse<SubscriptionData>>({
    queryKey: ['subscription', businessId],
    queryFn: () => api<ApiResponse<SubscriptionData>>(`/businesses/${businessId}/subscription`),
    enabled: !!businessId,
    staleTime: 60_000, // 1 min — subscription doesn't change often
  })

  const sub = query.data?.data ?? null

  return {
    subscription: sub,
    isLoading: query.isPending,
    isPro: ['PRO', 'BUSINESS'].includes(sub?.plan ?? ''),
    isBusiness: sub?.plan === 'BUSINESS',
    isFree: sub?.plan === 'FREE' || !sub,
  }
}
