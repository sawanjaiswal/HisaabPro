/** Stock Adjustments (mockup #48) — cursor-paginated log with search + direction.
 *
 * Search and direction go to the server rather than filtering in memory: unlike
 * the alert list, this one grows without bound — a busy shop adjusts stock
 * every day and never deletes the history.
 */

import { useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { getStockAdjustments } from './adjustments.service'
import type { AdjustmentFilter, StockAdjustment } from './adjustments.types'

const PAGE_SIZE = 20

interface UseStockAdjustmentsReturn {
  adjustments: StockAdjustment[]
  status: 'pending' | 'error' | 'success'
  refetch: () => void
  search: string
  setSearch: (value: string) => void
  filter: AdjustmentFilter
  setFilter: (value: AdjustmentFilter) => void
  hasMore: boolean
  isLoadingMore: boolean
  loadMore: () => void
}

export function useStockAdjustments(): UseStockAdjustmentsReturn {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<AdjustmentFilter>('ALL')
  const debouncedSearch = useDebounce(search)

  const query = useInfiniteQuery({
    queryKey: ['stock-adjustments', debouncedSearch, filter],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getStockAdjustments(
        {
          cursor: pageParam,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          direction: filter === 'ALL' ? undefined : filter,
        },
        signal,
      ),
    getNextPageParam: (last) => last.pagination.nextCursor ?? undefined,
  })

  const adjustments = useMemo(
    () => query.data?.pages.flatMap((page) => page.adjustments) ?? [],
    [query.data],
  )

  return {
    adjustments,
    status: query.isPending ? 'pending' : query.isError ? 'error' : 'success',
    refetch: () => void query.refetch(),
    search,
    setSearch,
    filter,
    setFilter,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
  }
}
