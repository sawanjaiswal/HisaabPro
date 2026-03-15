/** Party Statement hook
 *
 * Fetches the full ledger for a single party with cursor-based load-more.
 * All amounts are in PAISE — display via formatAmount() at render.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { STATEMENT_PAGE_LIMIT } from '../report.constants'
import { getPartyStatement } from '../report.service'
import type { PartyStatementFilters, PartyStatementResponse } from '../report.types'

type Status = 'loading' | 'error' | 'success'

interface UsePartyStatementReturn {
  data: PartyStatementResponse | null
  status: Status
  filters: PartyStatementFilters
  setFilter: <K extends keyof PartyStatementFilters>(
    key: K,
    value: PartyStatementFilters[K],
  ) => void
  loadMore: () => void
  refresh: () => void
}

const DEFAULT_FILTERS: PartyStatementFilters = {
  limit: STATEMENT_PAGE_LIMIT,
}

export function usePartyStatement(partyId: string): UsePartyStatementReturn {
  const toast = useToast()

  const [filters, setFilters] = useState<PartyStatementFilters>(DEFAULT_FILTERS)
  const [data, setData] = useState<PartyStatementResponse | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  const isLoadMore = useRef(false)

  useEffect(() => {
    if (!partyId) return

    const controller = new AbortController()

    if (!isLoadMore.current) {
      setStatus('loading')
    }

    getPartyStatement(partyId, filters, controller.signal)
      .then((response: PartyStatementResponse) => {
        setData((prev) => {
          if (!isLoadMore.current || prev === null) return response
          // Append incoming transactions to existing list
          return {
            ...response,
            data: {
              ...response.data,
              transactions: [
                ...prev.data.transactions,
                ...response.data.transactions,
              ],
            },
          }
        })
        setStatus('success')
        isLoadMore.current = false
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        isLoadMore.current = false
        const message =
          err instanceof ApiError ? err.message : 'Failed to load party statement'
        toast.error(message)
      })

    return () => controller.abort()
  }, [partyId, filters, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = useCallback(
    <K extends keyof PartyStatementFilters>(
      key: K,
      value: PartyStatementFilters[K],
    ) => {
      isLoadMore.current = false
      setFilters((prev) => ({ ...prev, [key]: value, cursor: undefined }))
    },
    [],
  )

  const loadMore = useCallback(() => {
    if (!data?.meta.hasMore || !data.meta.cursor) return
    isLoadMore.current = true
    setFilters((prev) => ({ ...prev, cursor: data.meta.cursor ?? undefined }))
  }, [data])

  const refresh = useCallback(() => {
    isLoadMore.current = false
    setFilters((prev) => ({ ...prev, cursor: undefined }))
    setRefreshKey((k) => k + 1)
  }, [])

  return { data, status, filters, setFilter, loadMore, refresh }
}
