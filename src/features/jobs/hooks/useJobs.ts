/** useJobs — infinite query with cursor pagination */

import { useInfiniteQuery } from '@tanstack/react-query'
import { listJobs } from '../api/jobs.api'
import type { ListJobsQuery } from '../api/jobs.api.types'
import type { JobListResponse } from '../jobs.types'

export const jobQueryKeys = {
  all:    () => ['jobs'] as const,
  list:   (q: ListJobsQuery) => ['jobs', 'list', q] as const,
  detail: (id: string) => ['jobs', 'detail', id] as const,
}

export function useJobs(filters: Omit<ListJobsQuery, 'cursor'> = {}) {
  return useInfiniteQuery<JobListResponse, Error>({
    queryKey: jobQueryKeys.list(filters),
    queryFn: ({ pageParam }) =>
      listJobs({ ...filters, cursor: pageParam as string | undefined }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}
