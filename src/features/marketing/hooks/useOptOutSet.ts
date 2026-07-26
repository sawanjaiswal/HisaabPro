/** useOptOutSet — returns Set<partyId> of opted-out parties for chip rendering */

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from '@/lib/api'

interface OptOutListResponse {
  optOuts: Array<{ id: string }>
  nextCursor: string | null
}

const EMPTY: ReadonlySet<string> = new Set()

export function useOptOutSet(): ReadonlySet<string> {
  const query = useQuery({
    queryKey: ['marketing', 'opt-outs', 'set'],
    queryFn: ({ signal }) =>
      api<OptOutListResponse>('/marketing/opt-outs?limit=500', { signal }),
    staleTime: 60_000,
  })

  return useMemo(() => {
    if (!query.data?.optOuts?.length) return EMPTY
    return new Set(query.data.optOuts.map((p) => p.id))
  }, [query.data])
}
