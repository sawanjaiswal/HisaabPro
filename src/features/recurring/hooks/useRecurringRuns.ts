/** useRecurringRuns — paginated run history query (NOT cached — history changes) */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { listRuns } from '../recurring.service'
import type { RecurringRun } from '../recurring.types'

interface UseRecurringRunsReturn {
  runs: RecurringRun[]
  isLoading: boolean
  isError: boolean
  nextCursor: string | null
  loadMore: () => void
  refetch: () => void
}

export function useRecurringRuns(scheduleId: string): UseRecurringRunsReturn {
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const query = useQuery({
    queryKey: queryKeys.recurring.runs(scheduleId, cursor),
    queryFn: ({ signal }) => listRuns(scheduleId, cursor, signal),
    enabled: Boolean(scheduleId),
  })

  return {
    runs: query.data?.items ?? [],
    isLoading: query.isPending,
    isError: query.isError,
    nextCursor: query.data?.nextCursor ?? null,
    loadMore: () => {
      const next = query.data?.nextCursor
      if (next) setCursor(next)
    },
    refetch: query.refetch,
  }
}
