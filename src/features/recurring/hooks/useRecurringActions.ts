/** Recurring -- CRUD actions + manual generate hook */

import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import {
  createRecurring,
  updateRecurring,
  deleteRecurring,
  generateDueInvoices,
} from '../recurring.service'
import type { CreateRecurringInput } from '../recurring.types'

export function useRecurringActions(refresh: () => void) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all() })
    refresh()
  }, [queryClient, refresh])

  const createMutation = useMutation({
    mutationFn: (input: CreateRecurringInput) => createRecurring(input),
    onSuccess: () => {
      toast.success('Recurring schedule created.')
      invalidate()
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Failed to create schedule.'
      toast.error(message)
    },
  })

  const pauseMutation = useMutation({
    mutationFn: (id: string) => updateRecurring(id, { status: 'PAUSED' }),
    onSuccess: () => {
      toast.success('Schedule paused.')
      invalidate()
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Failed to pause schedule.'
      toast.error(message)
    },
  })

  const resumeMutation = useMutation({
    mutationFn: (id: string) => updateRecurring(id, { status: 'ACTIVE' }),
    onSuccess: () => {
      toast.success('Schedule resumed.')
      invalidate()
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Failed to resume schedule.'
      toast.error(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRecurring(id),
    onSuccess: () => {
      toast.success('Schedule deleted.')
      invalidate()
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Failed to delete schedule.'
      toast.error(message)
    },
  })

  const generateMutation = useMutation({
    mutationFn: () => generateDueInvoices(),
    onSuccess: (result) => {
      toast.success(
        result.generated === 0
          ? 'No invoices due right now.'
          : `Generated ${result.generated} invoice${result.generated === 1 ? '' : 's'}.`,
      )
      invalidate()
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Generation failed.'
      toast.error(message)
    },
  })

  const handleCreate = useCallback(
    async (input: CreateRecurringInput) => {
      await createMutation.mutateAsync(input)
    },
    [createMutation],
  )

  const handlePause = useCallback(
    async (id: string) => {
      await pauseMutation.mutateAsync(id)
    },
    [pauseMutation],
  )

  const handleResume = useCallback(
    async (id: string) => {
      await resumeMutation.mutateAsync(id)
    },
    [resumeMutation],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id)
    },
    [deleteMutation],
  )

  const handleGenerate = useCallback(async () => {
    if (generateMutation.isPending) return
    await generateMutation.mutateAsync()
  }, [generateMutation])

  return {
    handleCreate,
    handlePause,
    handleResume,
    handleDelete,
    handleGenerate,
    generating: generateMutation.isPending,
  }
}
