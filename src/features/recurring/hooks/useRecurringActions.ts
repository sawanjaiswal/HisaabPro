/** Recurring — CRUD actions + manual generate hook */

import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import {
  createRecurring,
  updateRecurring,
  deleteRecurring,
  generateDueInvoices,
} from '../recurring.service'
import type { CreateRecurringInput } from '../recurring.types'

export function useRecurringActions(refresh: () => void) {
  const toast = useToast()
  const [generating, setGenerating] = useState(false)

  const handleCreate = useCallback(
    async (input: CreateRecurringInput) => {
      await createRecurring(input)
      toast.success('Recurring schedule created.')
      refresh()
    },
    [toast, refresh]
  )

  const handlePause = useCallback(
    async (id: string) => {
      try {
        await updateRecurring(id, { status: 'PAUSED' })
        toast.success('Schedule paused.')
        refresh()
      } catch (err: unknown) {
        const message = err instanceof ApiError ? err.message : 'Failed to pause schedule.'
        toast.error(message)
      }
    },
    [toast, refresh]
  )

  const handleResume = useCallback(
    async (id: string) => {
      try {
        await updateRecurring(id, { status: 'ACTIVE' })
        toast.success('Schedule resumed.')
        refresh()
      } catch (err: unknown) {
        const message = err instanceof ApiError ? err.message : 'Failed to resume schedule.'
        toast.error(message)
      }
    },
    [toast, refresh]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteRecurring(id)
        toast.success('Schedule deleted.')
        refresh()
      } catch (err: unknown) {
        const message = err instanceof ApiError ? err.message : 'Failed to delete schedule.'
        toast.error(message)
      }
    },
    [toast, refresh]
  )

  const handleGenerate = useCallback(async () => {
    if (generating) return
    setGenerating(true)
    try {
      const result = await generateDueInvoices()
      toast.success(
        result.generated === 0
          ? 'No invoices due right now.'
          : `Generated ${result.generated} invoice${result.generated === 1 ? '' : 's'}.`
      )
      refresh()
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Generation failed.'
      toast.error(message)
    } finally {
      setGenerating(false)
    }
  }, [generating, toast, refresh])

  return { handleCreate, handlePause, handleResume, handleDelete, handleGenerate, generating }
}
