/** Party Statement hook (TanStack Query)
 *
 * Fetches the full ledger for a single party with cursor-based load-more.
 * All amounts are in PAISE -- display via formatAmount() at render.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState<PartyStatementFilters>(DEFAULT_FILTERS)
  const isLoadMore = useRef(false)
  const [mergedData, setMergedData] = useState<PartyStatementResponse | null>(null)

  const query = useQuery({
    queryKey: queryKeys.reports.partyStatement(partyId, filters),
    queryFn: ({ signal }) => getPartyStatement(partyId, filters, signal),
    enabled: Boolean(partyId),
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    if (!query.data) return
    const appendMode = isLoadMore.current
    if (!appendMode || mergedData === null) {
      setMergedData(query.data)
    } else {
      setMergedData((prev) => {
        if (!prev) return query.data!
        return {
          ...query.data!,
          data: {
            ...query.data!.data,
            transactions: [
              ...prev.data.transactions,
              ...query.data!.data.transactions,
            ],
          },
        }
      })
    }
    isLoadMore.current = false
  }, [query.data]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (query.isError) {
      isLoadMore.current = false
      const err = query.error
      toast.error(err instanceof ApiError ? err.message : 'Failed to load party statement')
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const setFilter = useCallback(
    <K extends keyof PartyStatementFilters>(
      key: K,
      value: PartyStatementFilters[K],
    ) => {
      isLoadMore.current = false
      setMergedData(null)
      setFilters((prev) => ({ ...prev, [key]: value, cursor: undefined }))
    },
    [],
  )

  const loadMore = useCallback(() => {
    if (!mergedData?.meta.hasMore || !mergedData.meta.cursor) return
    isLoadMore.current = true
    setFilters((prev) => ({ ...prev, cursor: mergedData.meta.cursor ?? undefined }))
  }, [mergedData])

  const refresh = useCallback(() => {
    isLoadMore.current = false
    setMergedData(null)
    setFilters((prev) => ({ ...prev, cursor: undefined }))
    queryClient.invalidateQueries({ queryKey: ['reports', 'party-statement'] })
  }, [queryClient])

  return { data: mergedData, status, filters, setFilter, loadMore, refresh }
}
