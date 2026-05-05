/** useCreateJob — mutation for creating a new job */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { createJob } from '../api/jobs.api'
import { jobQueryKeys } from './useJobs'
import type { CreateJobInput } from '../api/jobs.api.types'

export function useCreateJob() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (data: CreateJobInput) => createJob(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.all() })
      toast.success('Job created')
    },
    onError: () => {
      toast.error('Failed to create job')
    },
  })
}
