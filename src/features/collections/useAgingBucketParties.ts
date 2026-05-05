/**
 * useAgingBucketParties — infinite-scroll hook for one aging bucket.
 * Uses cursor pagination from the server.
 */

import { useInfiniteQuery } from '@tanstack/react-query'
import { getAgingParties } from './collections.service'
import type { AgingPartiesResult, AgingBucketParam } from './collections.types'

export function useAgingBucketParties(bucket: AgingBucketParam) {
  return useInfiniteQuery<AgingPartiesResult, Error>({
    queryKey: ['collections', 'aging', 'parties', bucket],
    queryFn: ({ pageParam }) =>
      getAgingParties(bucket, pageParam as string | undefined),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}
