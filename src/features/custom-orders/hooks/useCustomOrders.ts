/** useCustomOrders — infinite query with cursor pagination */

import { useInfiniteQuery } from '@tanstack/react-query'
import { listCustomOrders } from '../api/custom-orders.api'
import type { ListCustomOrdersQuery } from '../api/custom-orders.api.types'
import type { CustomOrderListResponse } from '../custom-orders.types'

export const orderQueryKeys = {
  all:    () => ['custom-orders'] as const,
  list:   (q: ListCustomOrdersQuery) => ['custom-orders', 'list', q] as const,
  detail: (id: string) => ['custom-orders', 'detail', id] as const,
}

export function useCustomOrders(filters: Omit<ListCustomOrdersQuery, 'cursor'> = {}) {
  return useInfiniteQuery<CustomOrderListResponse, Error>({
    queryKey: orderQueryKeys.list(filters),
    queryFn: ({ pageParam }) =>
      listCustomOrders({ ...filters, cursor: pageParam as string | undefined }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}
