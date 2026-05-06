/** useRecurring — detail query + pause/resume/generateNow/delete mutations */

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import {
  getRecurring,
  pauseRecurring,
  resumeRecurring,
  generateNow,
  deleteRecurring,
} from '../recurring.service'
import type { RecurringInvoice } from '../recurring.types'

interface UseRecurringReturn {
  schedule: RecurringInvoice | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
  pause: (label: string) => Promise<void>
  resume: (label: string) => Promise<void>
  generate: (label: string) => Promise<void>
  remove: (label: string) => Promise<void>
  isPausing: boolean
  isResuming: boolean
  isGenerating: boolean
  isDeleting: boolean
}

export function useRecurring(id: string): UseRecurringReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.recurring.detail(id),
    queryFn: ({ signal }) => getRecurring(id, signal),
    enabled: Boolean(id),
  })

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all() })
  }, [queryClient])

  const pauseMutation = useMutation({
    mutationFn: (label: string) => pauseRecurring(id, label),
    onSuccess: () => {
      toast.success('Schedule paused.')
      invalidate()
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : 'Failed to pause schedule.'
      toast.error(msg)
    },
  })

  const resumeMutation = useMutation({
    mutationFn: (label: string) => resumeRecurring(id, label),
    onSuccess: () => {
      toast.success('Schedule resumed.')
      invalidate()
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : 'Failed to resume schedule.'
      toast.error(msg)
    },
  })

  const generateMutation = useMutation({
    mutationFn: (label: string) =>
      generateNow(id, label, `${id}_manual_${new Date().toISOString().slice(0, 10)}`),
    onSuccess: () => {
      const online = navigator.onLine
      toast.success(online ? 'Invoice generated.' : 'Queued — will generate when online.')
      invalidate()
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : 'Generation failed.'
      toast.error(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (label: string) => deleteRecurring(id, label),
    onSuccess: () => {
      toast.success('Schedule deleted.')
      invalidate()
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : 'Failed to delete schedule.'
      toast.error(msg)
    },
  })

  return {
    schedule: query.data,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    pause: async (label) => { await pauseMutation.mutateAsync(label) },
    resume: async (label) => { await resumeMutation.mutateAsync(label) },
    generate: async (label) => { await generateMutation.mutateAsync(label) },
    remove: async (label) => { await deleteMutation.mutateAsync(label) },
    isPausing: pauseMutation.isPending,
    isResuming: resumeMutation.isPending,
    isGenerating: generateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
