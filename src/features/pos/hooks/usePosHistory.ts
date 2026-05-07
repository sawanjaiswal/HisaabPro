/** POS — Sales history with cursor pagination + filters */

import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { listSales } from '../api/pos.service'
import { SALES_PAGE_LIMIT } from '../utils/pos.constants'
import type { PosListResponse, PosHistoryFilters, PosSaleStatus, PaymentMode } from '../types/pos.types'

export const POS_SALES_KEY = 'pos-sales'

const DEFAULT_FILTERS: PosHistoryFilters = {
  limit: SALES_PAGE_LIMIT,
  status: '',
  paymentMode: '',
}

function flattenPages(pages: PosListResponse[] | undefined) {
  if (!pages) return []
  return pages.flatMap((p) => p.sales)
}

export function usePosHistory() {
  const [filters, setFilters] = useState<PosHistoryFilters>(DEFAULT_FILTERS)

  const query = useInfiniteQuery({
    queryKey:         [POS_SALES_KEY, filters],
    queryFn:          ({ pageParam }) =>
      listSales({ ...filters, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: PosListResponse) => last.nextCursor ?? undefined,
    staleTime:        0,
  })

  const sales      = flattenPages(query.data?.pages)
  const totalCount = query.data?.pages[0]?.totalCount ?? 0

  const setFilter = <K extends keyof PosHistoryFilters>(key: K, value: PosHistoryFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value, cursor: undefined }))
  }

  const setDateRange = (from?: string, to?: string) => {
    setFilters((prev) => ({ ...prev, from, to, cursor: undefined }))
  }

  const setStatus = (status: PosSaleStatus | '') => setFilter('status', status)
  const setPaymentMode = (mode: PaymentMode | '') => setFilter('paymentMode', mode)
  const resetFilters = () => setFilters(DEFAULT_FILTERS)

  return {
    sales,
    totalCount,
    filters,
    isLoading: query.isLoading,
    isError:   query.isError,
    isEmpty:   !query.isLoading && !query.isError && sales.length === 0,
    hasMore:   query.hasNextPage ?? false,
    fetchMore: () => { void query.fetchNextPage() },
    isFetchingMore: query.isFetchingNextPage,
    refetch:   () => { void query.refetch() },
    setFilter,
    setDateRange,
    setStatus,
    setPaymentMode,
    resetFilters,
  }
}
