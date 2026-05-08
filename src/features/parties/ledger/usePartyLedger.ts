/** Party Ledger — TanStack Query hook with cursor pagination */

import { useState, useCallback } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { getPartyLedger } from './ledger.service'
import type { LedgerParams, LedgerVoucherType, LedgerRow } from './ledger.types'

/** Default date range: last 90 days */
function defaultDateRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 90)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}

const PAGE_LIMIT = 30

export interface UsePartyLedgerReturn {
  rows: LedgerRow[]
  openingBalance: number
  closingBalance: number
  partyName: string
  totalCount: number
  status: 'loading' | 'error' | 'success' | 'idle'
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  from: string
  to: string
  selectedTypes: LedgerVoucherType[]
  setFrom: (v: string) => void
  setTo: (v: string) => void
  setSelectedTypes: (v: LedgerVoucherType[]) => void
  refresh: () => void
}

export function usePartyLedger(partyId: string): UsePartyLedgerReturn {
  const defaults = defaultDateRange()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [selectedTypes, setSelectedTypes] = useState<LedgerVoucherType[]>([])

  const params: LedgerParams = {
    from,
    to,
    voucherTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
    limit: PAGE_LIMIT,
  }

  const query = useInfiniteQuery({
    queryKey: queryKeys.parties.ledger(partyId, params),
    queryFn: ({ pageParam, signal }) =>
      getPartyLedger(
        partyId,
        { ...params, cursor: pageParam as string | undefined },
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!partyId,
  })

  const rows = query.data?.pages.flatMap((p) => p.rows) ?? []
  const lastPage = query.data?.pages[query.data.pages.length - 1]

  const status: 'loading' | 'error' | 'success' | 'idle' =
    query.isPending
      ? 'loading'
      : query.isError
        ? 'error'
        : query.isSuccess
          ? 'success'
          : 'idle'

  const refresh = useCallback(() => {
    query.refetch()
  }, [query])

  return {
    rows,
    openingBalance: lastPage?.openingBalance ?? 0,
    closingBalance: lastPage?.closingBalance ?? 0,
    partyName: lastPage?.partyName ?? '',
    totalCount: lastPage?.totalCount ?? 0,
    status,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    from,
    to,
    selectedTypes,
    setFrom,
    setTo,
    setSelectedTypes,
    refresh,
  }
}
