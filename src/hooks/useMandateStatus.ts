/**
 * useMandateStatus — polls `GET /subscription/mandate` every 30s while status
 * is PENDING. Stops polling once the server reports ACTIVE / FAILED / null.
 */

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { MANDATE_POLL_MS } from '@/features/subscription/subscription.constants'
import type { MandateStatus } from '@/features/subscription/subscription.types'

interface MandateStatusResponse {
  mandateId: string | null
  status: MandateStatus | null
}

export function useMandateStatus(opts?: { enabled?: boolean }) {
  const { user } = useAuth()
  const enabled = (opts?.enabled ?? true) && !!user?.businessId

  const query = useQuery<MandateStatusResponse>({
    queryKey: ['mandate-status', user?.businessId],
    queryFn: () => api<MandateStatusResponse>('/subscription/mandate'),
    enabled,
    // Poll only while PENDING; the predicate fires after each successful read.
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s === 'PENDING' ? MANDATE_POLL_MS : false
    },
  })

  return {
    mandate: query.data ?? null,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    isPending: query.data?.status === 'PENDING',
    isActive: query.data?.status === 'ACTIVE',
  }
}
