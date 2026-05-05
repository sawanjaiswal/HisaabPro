/** useJob — query for a single job detail */

import { useQuery } from '@tanstack/react-query'
import { getJob } from '../api/jobs.api'
import { jobQueryKeys } from './useJobs'

export function useJob(id: string) {
  return useQuery({
    queryKey: jobQueryKeys.detail(id),
    queryFn: () => getJob(id),
    enabled: Boolean(id),
  })
}
