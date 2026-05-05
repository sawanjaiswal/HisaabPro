/**
 * useAgingData — TanStack Query hook for aging bucket summary.
 *
 * staleTime matches server-side cache TTL (5 min) to avoid
 * redundant refetches while data is still fresh.
 */

import { useQuery } from '@tanstack/react-query'
import { getAging } from './collections.service'
import type { AgingBucketResult } from './collections.types'

export function useAgingData() {
  return useQuery<AgingBucketResult, Error>({
    queryKey: ['collections', 'aging'],
    queryFn: getAging,
    staleTime: 5 * 60 * 1000, // 5 minutes — matches server cache TTL
    gcTime: 10 * 60 * 1000,   // keep in memory 10 min after unmount
  })
}
