/** Settings — Audit log hook (TanStack Query)
 *
 * Manages paginated audit log with optional filters.
 * setFilter resets to page 1. loadMore appends the next page.
 * businessId is passed as a parameter.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { getAuditLog } from './audit-log.service'
import type { AuditLogEntry, AuditLogFilters, AuditAction } from './settings.types'

type Status = 'loading' | 'error' | 'success'

const DEFAULT_FILTERS: AuditLogFilters = {
  page: 1,
  limit: 50,
}

interface AuditLogData {
  entries: AuditLogEntry[]
  pagination: { page: number; limit: number; total: number }
}

interface UseAuditLogReturn {
  data: AuditLogData | null
  status: Status
  filters: AuditLogFilters
  setFilter: <K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) => void
  loadMore: () => void
  refresh: () => void
}

export function useAuditLog(businessId: string): UseAuditLogReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState<AuditLogFilters>(DEFAULT_FILTERS)
  // Accumulated entries for append-on-loadMore
  const accumulatedRef = useRef<AuditLogEntry[]>([])

  const query = useQuery({
    queryKey: queryKeys.settings.auditLog(filters as unknown as Record<string, unknown>),
    queryFn: ({ signal }) => getAuditLog(businessId, filters, signal),
    enabled: !!businessId,
  })

  // Build accumulated data: on page 1 reset, on subsequent pages append
  const rawData = query.data?.data ?? null

  const data: AuditLogData | null = (() => {
    if (!rawData) return null

    if (filters.page === 1) {
      accumulatedRef.current = rawData.entries
    } else {
      // Append — avoid duplicates by id
      const existingIds = new Set(accumulatedRef.current.map((e) => e.id))
      const newEntries = rawData.entries.filter((e) => !existingIds.has(e.id))
      accumulatedRef.current = [...accumulatedRef.current, ...newEntries]
    }

    return { entries: accumulatedRef.current, pagination: rawData.pagination }
  })()

  // Only show loading skeleton on first page
  const status: Status = (() => {
    if (query.isPending && filters.page === 1) return 'loading'
    if (query.isError) return 'error'
    if (query.isSuccess) return 'success'
    // loadMore in progress — keep showing success (entries already visible)
    return data ? 'success' : 'loading'
  })()

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load audit log'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = useCallback(<K extends keyof AuditLogFilters>(
    key: K,
    value: AuditLogFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }, [])

  const loadMore = useCallback(() => {
    if (data === null) return
    const { page, limit, total } = data.pagination
    const hasMore = page * limit < total
    if (!hasMore) return
    setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))
  }, [data])

  const refresh = useCallback(() => {
    accumulatedRef.current = []
    setFilters((prev) => ({ ...prev, page: 1 }))
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.all() })
  }, [queryClient])

  return { data, status, filters, setFilter, loadMore, refresh }
}

// Re-export filter type convenience
export type { AuditAction }
