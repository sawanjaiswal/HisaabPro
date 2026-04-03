/** useJournalEntries — Paginated journal entries with type/status filters (TanStack Query) */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<JournalEntryFilters>(DEFAULT_FILTERS)
  // Track accumulated entries for append-on-loadMore
  const accumulatedRef = useRef<JournalEntry[]>([])
  const isLoadMore = useRef(false)

  const query = useQuery({
    queryKey: queryKeys.accounting.journals(filters as unknown as Record<string, unknown>),
    queryFn: ({ signal }) => getJournalEntries(filters, signal),
  })

  // Build accumulated entries: on page 1 reset, on loadMore append
  const rawItems = query.data?.items ?? []
  const total = query.data?.total ?? 0

  if (query.isSuccess) {
    if (!isLoadMore.current || filters.page === 1) {
      accumulatedRef.current = rawItems
    } else {
      // Append new items
      const existingIds = new Set(accumulatedRef.current.map((e) => e.id))
      const newItems = rawItems.filter((e) => !existingIds.has(e.id))
      accumulatedRef.current = [...accumulatedRef.current, ...newItems]
    }
    isLoadMore.current = false
  }

  const entries = accumulatedRef.current

  // Only show loading skeleton on first page / filter change
  const status: Status = (() => {
    if (query.isPending && !isLoadMore.current) return 'loading'
    if (query.isError) return 'error'
    if (query.isSuccess) return 'success'
    return entries.length > 0 ? 'success' : 'loading'
  })()

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      isLoadMore.current = false
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load entries'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const setTypeFilter = useCallback((type: JournalEntryType | undefined) => {
    isLoadMore.current = false
    accumulatedRef.current = []
    setFilters((prev) => ({ ...prev, type, page: 1 }))
  }, [])

  const setStatusFilter = useCallback((s: EntryStatus | undefined) => {
    isLoadMore.current = false
    accumulatedRef.current = []
    setFilters((prev) => ({ ...prev, status: s, page: 1 }))
  }, [])

  const loadMore = useCallback(() => {
    isLoadMore.current = true
    setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))
  }, [])

  const refresh = useCallback(() => {
    isLoadMore.current = false
    accumulatedRef.current = []
    setFilters((prev) => ({ ...prev, page: 1 }))
    queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all() })
  }, [queryClient])

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
