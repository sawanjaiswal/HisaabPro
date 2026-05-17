/**
 * Loyalty #125 — Per-party ledger hook (cursor-paginated, infinite).
 *
 * Mirrors usePartyLedger structure for consistency.
 * Cache key: queryKeys.loyalty.ledger(partyId).
 */

import { useCallback } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { getLedger } from '../api/loyalty.service'
import { LEDGER_PAGE_SIZE_DEFAULT } from '../loyalty.constants'
import type { LoyaltyLedgerRowDTO } from '../loyalty.types'

interface UseLoyaltyLedgerArgs {
  partyId: string | undefined
  enabled?: boolean
  pageSize?: number
}

interface UseLoyaltyLedgerReturn {
  rows: LoyaltyLedgerRowDTO[]
  status: 'loading' | 'error' | 'success' | 'idle'
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  refresh: () => void
}

export function useLoyaltyLedger({
  partyId,
  enabled = true,
  pageSize = LEDGER_PAGE_SIZE_DEFAULT,
}: UseLoyaltyLedgerArgs): UseLoyaltyLedgerReturn {
  const isEnabled = Boolean(partyId) && enabled

  const query = useInfiniteQuery({
    queryKey: partyId
      ? queryKeys.loyalty.ledger(partyId)
      : queryKeys.loyalty.ledger('__none__'),
    queryFn: ({ pageParam }) =>
      getLedger(partyId as string, {
        cursor: pageParam as string | undefined,
        limit: pageSize,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isEnabled,
  })

  const rows = query.data?.pages.flatMap((p) => p.rows) ?? []

  const status: 'loading' | 'error' | 'success' | 'idle' = !isEnabled
    ? 'idle'
    : query.isPending
      ? 'loading'
      : query.isError
        ? 'error'
        : query.isSuccess
          ? 'success'
          : 'idle'

  const refresh = useCallback(() => {
    void query.refetch()
  }, [query])

  return {
    rows,
    status,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refresh,
  }
}
