/** useReconciliationDetail — summary + paginated entries with matchStatus filter */

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { getReconciliationDetail, getReconciliationEntries } from './reconciliation.service'
import { RECON_PAGE_LIMIT } from './reconciliation.constants'
import type { MatchStatus, ReconciliationEntry, ReconciliationSummary } from './reconciliation.types'

type Status = 'loading' | 'error' | 'success'

interface UseReconciliationDetailReturn {
  summary: ReconciliationSummary | null
  entries: ReconciliationEntry[]
  summaryStatus: Status
  entriesStatus: Status
  matchFilter: MatchStatus | 'ALL'
  setMatchFilter: (f: MatchStatus | 'ALL') => void
  entriesTotal: number
  hasMoreEntries: boolean
  loadMoreEntries: () => void
  refresh: () => void
}

export function useReconciliationDetail(id: string): UseReconciliationDetailReturn {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [matchFilter, setMatchFilterState] = useState<MatchStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)

  // Summary query
  const summaryQuery = useQuery({
    queryKey: queryKeys.gstReconciliation.detail(id),
    queryFn: ({ signal }) => getReconciliationDetail(id, signal),
  })

  useEffect(() => {
    if (summaryQuery.isError) {
      const err = summaryQuery.error
      const message = err instanceof ApiError ? err.message : 'Failed to load summary'
      toast.error(message)
    }
  }, [summaryQuery.isError, summaryQuery.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const summaryStatus: Status = summaryQuery.isPending
    ? 'loading'
    : summaryQuery.isError ? 'error' : 'success'

  // Entries query
  const entriesQuery = useQuery({
    queryKey: ['gst-reconciliation', 'entries', id, { matchFilter, page }] as const,
    queryFn: ({ signal }) =>
      getReconciliationEntries(
        { id, matchStatus: matchFilter, page, limit: RECON_PAGE_LIMIT },
        signal,
      ),
  })

  useEffect(() => {
    if (entriesQuery.isError) {
      const err = entriesQuery.error
      const message = err instanceof ApiError ? err.message : 'Failed to load entries'
      toast.error(message)
    }
  }, [entriesQuery.isError, entriesQuery.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const entriesStatus: Status = entriesQuery.isPending
    ? 'loading'
    : entriesQuery.isError ? 'error' : 'success'

  const entries = entriesQuery.data?.data ?? []
  const entriesTotal = entriesQuery.data?.total ?? 0
  const hasMoreEntries = entries.length < entriesTotal

  const setMatchFilter = useCallback((f: MatchStatus | 'ALL') => {
    setMatchFilterState(f)
    setPage(1)
  }, [])

  const loadMoreEntries = useCallback(() => {
    setPage((p) => p + 1)
  }, [])

  const refresh = useCallback(() => {
    setPage(1)
    void queryClient.invalidateQueries({ queryKey: queryKeys.gstReconciliation.detail(id) })
    void queryClient.invalidateQueries({ queryKey: ['gst-reconciliation', 'entries', id] })
  }, [queryClient, id])

  return {
    summary: summaryQuery.data ?? null,
    entries,
    summaryStatus,
    entriesStatus,
    matchFilter,
    setMatchFilter,
    entriesTotal,
    hasMoreEntries,
    loadMoreEntries,
    refresh,
  }
}
