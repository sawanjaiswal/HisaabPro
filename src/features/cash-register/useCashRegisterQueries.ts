/** Cash Register — TanStack Query read hooks */

import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { CASH_QUERY_KEYS } from './cashRegister.constants'
import { listCashEntries, getCashSummary, getCashEntry } from './cashRegister.service'
import type { CashHistoryFilter, CashHistorySort } from './cashRegister.types'

// ─── Summary ──────────────────────────────────────────────────────────────────

export function useCashSummary(businessId: string, tzOffsetMinutes: number) {
  return useQuery({
    queryKey: CASH_QUERY_KEYS.summary(businessId, tzOffsetMinutes),
    queryFn: () => getCashSummary({ businessId, tzOffsetMinutes }),
    enabled: Boolean(businessId),
    // No cacheReads — notes may carry PII (OFFLINE_RULES Rule 3)
    staleTime: 30_000,
    retry: 2,
  })
}

// ─── History (infinite / cursor-paginated) ────────────────────────────────────

type HistoryPage = { entries: import('./cashRegister.types').CashEntryDTO[]; nextCursor: string | null }

export function useCashHistory(
  businessId: string,
  filter: CashHistoryFilter,
  sort: CashHistorySort,
  tzOffsetMinutes: number,
) {
  return useInfiniteQuery<HistoryPage, Error>({
    queryKey: CASH_QUERY_KEYS.history(businessId, filter, sort, tzOffsetMinutes),
    queryFn: ({ pageParam }) =>
      listCashEntries({
        businessId,
        filter,
        sort,
        tzOffsetMinutes,
        cursor: pageParam as string | undefined,
        limit: 50,
      }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(businessId),
    staleTime: 15_000,
    retry: 2,
  })
}

// ─── Single entry ─────────────────────────────────────────────────────────────

export function useCashEntry(businessId: string, id: string | null) {
  return useQuery({
    queryKey: CASH_QUERY_KEYS.entry(businessId, id ?? ''),
    queryFn: () => getCashEntry({ businessId, id: id! }),
    enabled: Boolean(businessId) && Boolean(id),
    staleTime: 60_000,
  })
}
