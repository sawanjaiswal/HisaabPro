/**
 * useStatement — TanStack Query hook for Customer Statement data.
 *
 * Disabled until partyId + from + to are all present.
 * No cacheReads: PII (phone, address, transaction history) per OFFLINE_RULES rule 3.
 */

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { StatementData } from './statement.types'

export function useStatement(
  partyId: string | undefined,
  from: string | undefined,
  to: string | undefined
) {
  return useQuery<StatementData, Error>({
    queryKey: ['statement', partyId, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ from: from!, to: to! })
      return api<StatementData>(
        `/collections/statement/${partyId}?${params.toString()}`
      )
    },
    enabled: Boolean(partyId) && Boolean(from) && Boolean(to),
    staleTime: 0,     // always fresh — statement data changes with payments
    gcTime: 2 * 60 * 1000,
  })
}
