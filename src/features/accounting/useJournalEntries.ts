/** useJournalEntries — Paginated journal entries with type/status filters */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { getJournalEntries } from './accounting.service'
import { ACCOUNTING_PAGE_LIMIT } from './accounting.constants'
import type { JournalEntry, JournalEntryFilters, JournalEntryType, EntryStatus } from './accounting.types'

type Status = 'loading' | 'error' | 'success'

interface UseJournalEntriesReturn {
  entries: JournalEntry[]
  total: number
  status: Status
  filters: JournalEntryFilters
  hasMore: boolean
  setTypeFilter: (type: JournalEntryType | undefined) => void
  setStatusFilter: (status: EntryStatus | undefined) => void
  loadMore: () => void
  refresh: () => void
}

const DEFAULT_FILTERS: JournalEntryFilters = {
  page: 1,
  limit: ACCOUNTING_PAGE_LIMIT,
}

export function useJournalEntries(): UseJournalEntriesReturn {
  const toast = useToast()
  const [filters, setFilters] = useState<JournalEntryFilters>(DEFAULT_FILTERS)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)
  const [isLoadMore, setIsLoadMore] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    if (!isLoadMore) setStatus('loading')

    getJournalEntries(filters, controller.signal)
      .then((res) => {
        setEntries((prev) =>
          isLoadMore ? [...prev, ...res.items] : res.items
        )
        setTotal(res.total)
        setStatus('success')
        setIsLoadMore(false)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        setIsLoadMore(false)
        const message = err instanceof ApiError ? err.message : 'Failed to load entries'
        toast.error(message)
      })

    return () => controller.abort()
  }, [filters, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const setTypeFilter = useCallback((type: JournalEntryType | undefined) => {
    setIsLoadMore(false)
    setFilters((prev) => ({ ...prev, type, page: 1 }))
  }, [])

  const setStatusFilter = useCallback((s: EntryStatus | undefined) => {
    setIsLoadMore(false)
    setFilters((prev) => ({ ...prev, status: s, page: 1 }))
  }, [])

  const loadMore = useCallback(() => {
    setIsLoadMore(true)
    setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))
  }, [])

  const refresh = useCallback(() => {
    setIsLoadMore(false)
    setFilters((prev) => ({ ...prev, page: 1 }))
    setRefreshKey((k) => k + 1)
  }, [])

  const page = filters.page ?? 1
  const limit = filters.limit ?? ACCOUNTING_PAGE_LIMIT
  const hasMore = page * limit < total

  return {
    entries,
    total,
    status,
    filters,
    hasMore,
    setTypeFilter,
    setStatusFilter,
    loadMore,
    refresh,
  }
}
