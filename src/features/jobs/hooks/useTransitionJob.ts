/** useTransitionJob — mutation for status machine transitions */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { transitionJob } from '../api/jobs.api'
import { jobQueryKeys } from './useJobs'
import type { TransitionJobInput } from '../api/jobs.api.types'

interface TransitionVars {
  id: string
  data: TransitionJobInput
  title: string
}

export function useTransitionJob() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, data, title }: TransitionVars) => transitionJob(id, data, title),
    onSuccess: (_result, vars) => {
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.detail(vars.id) })
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.all() })
      toast.success(`Status updated to ${vars.data.toStatus.replace('_', ' ')}`)
    },
    onError: () => {
      toast.error('Failed to update status')
    },
  })
}
