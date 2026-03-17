/** Settings — Audit log hook
 *
 * Manages paginated audit log with optional filters.
 * setFilter resets to page 1. loadMore appends the next page.
 * AbortController cleans up in-flight requests on filter change.
 * businessId is passed as a parameter.
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
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

  const [filters, setFilters] = useState<AuditLogFilters>(DEFAULT_FILTERS)
  const [data, setData] = useState<AuditLogData | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)
  // Track which page was used in last load to support append-on-loadMore
  const [loadedPage, setLoadedPage] = useState(1)

  useEffect(() => {
    if (!businessId) return

    const controller = new AbortController()

    // Only show full loading skeleton on first page or filter change
    if (filters.page === 1) {
      setStatus('loading')
    }

    getAuditLog(businessId, filters, controller.signal)
      .then((response) => {
        const incoming = response.data

        setData((prev) => {
          if (filters.page === 1 || prev === null) {
            return { entries: incoming.entries, pagination: incoming.pagination }
          }
          // Append for loadMore — avoid duplicates by id
          const existingIds = new Set(prev.entries.map((e) => e.id))
          const newEntries = incoming.entries.filter((e) => !existingIds.has(e.id))
          return {
            entries: [...prev.entries, ...newEntries],
            pagination: incoming.pagination,
          }
        })

        setLoadedPage(filters.page)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load audit log'
        toast.error(message)
      })

    return () => controller.abort()
  }, [businessId, filters, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setFilters((prev) => ({ ...prev, page: loadedPage + 1 }))
  }, [data, loadedPage])

  const refresh = useCallback(() => {
    setFilters((prev) => ({ ...prev, page: 1 }))
    setRefreshKey((k) => k + 1)
  }, [])

  return { data, status, filters, setFilter, loadMore, refresh }
}

// Re-export filter type convenience
export type { AuditAction }
