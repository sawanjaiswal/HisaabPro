/** Party Detail — Hook to fetch and manage a single party (TanStack Query) */

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { getParty } from './party.service'
import type { PartyDetail } from './party.types'

type DetailStatus = 'loading' | 'error' | 'success'
type DetailTab = 'ledger' | 'invoices' | 'payments' | 'info'

interface UsePartyDetailReturn {
  party: PartyDetail | null
  status: DetailStatus
  activeTab: DetailTab
  setActiveTab: (tab: DetailTab) => void
  refresh: () => void
}

export function usePartyDetail(id: string): UsePartyDetailReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<DetailTab>('ledger')

  const query = useQuery({
    queryKey: queryKeys.parties.detail(id),
    queryFn: ({ signal }) => getParty(id, signal),
    enabled: Boolean(id),
  })

  const party = query.data ?? null
  const status: DetailStatus = !id ? 'loading' : query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load party'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    if (id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.parties.detail(id) }) // ssot-allow: reconcile party react-query cache after a mutation — detail query refresh
    }
  }, [queryClient, id])

  return {
    party,
    status,
    activeTab,
    setActiveTab,
    refresh,
  }
}
