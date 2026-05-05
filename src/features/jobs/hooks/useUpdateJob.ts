/** useUpdateJob — mutation for patching an existing job */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { updateJob } from '../api/jobs.api'
import { jobQueryKeys } from './useJobs'
import type { UpdateJobInput } from '../api/jobs.api.types'

interface UpdateJobVars {
  id: string
  data: UpdateJobInput
  title: string
}

export function useUpdateJob() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, data, title }: UpdateJobVars) => updateJob(id, data, title),
    onSuccess: (_result, vars) => {
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.detail(vars.id) })
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.all() })
      toast.success('Job updated')
    },
    onError: () => {
      toast.error('Failed to update job')
    },
  })
}
