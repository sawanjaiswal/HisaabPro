/** useReconciliationDetail — summary + paginated entries with matchStatus filter */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
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

  const [summary, setSummary]             = useState<ReconciliationSummary | null>(null)
  const [summaryStatus, setSummaryStatus] = useState<Status>('loading')
  const [entries, setEntries]             = useState<ReconciliationEntry[]>([])
  const [entriesStatus, setEntriesStatus] = useState<Status>('loading')
  const [matchFilter, setMatchFilterState] = useState<MatchStatus | 'ALL'>('ALL')
  const [page, setPage]                   = useState(1)
  const [entriesTotal, setEntriesTotal]   = useState(0)
  const [refreshKey, setRefreshKey]       = useState(0)

  // Fetch summary
  useEffect(() => {
    const controller = new AbortController()
    setSummaryStatus('loading')

    getReconciliationDetail(id, controller.signal)
      .then((data) => { setSummary(data); setSummaryStatus('success') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setSummaryStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load summary'
        toast.error(message)
      })

    return () => controller.abort()
  }, [id, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch entries (re-runs on filter or page change)
  useEffect(() => {
    const controller = new AbortController()
    setEntriesStatus('loading')

    getReconciliationEntries(
      { id, matchStatus: matchFilter, page, limit: RECON_PAGE_LIMIT },
      controller.signal
    )
      .then((res) => {
        setEntries((prev) => page === 1 ? res.data : [...prev, ...res.data])
        setEntriesTotal(res.total)
        setEntriesStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setEntriesStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load entries'
        toast.error(message)
      })

    return () => controller.abort()
  }, [id, matchFilter, page, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const setMatchFilter = useCallback((f: MatchStatus | 'ALL') => {
    setMatchFilterState(f)
    setPage(1)
    setEntries([])
  }, [])

  const loadMoreEntries = useCallback(() => {
    setPage((p) => p + 1)
  }, [])

  const refresh = useCallback(() => {
    setPage(1)
    setEntries([])
    setRefreshKey((k) => k + 1)
  }, [])

  const hasMoreEntries = entries.length < entriesTotal

  return {
    summary,
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
