/** Batch Tracking -- Form hook (create + edit)
 *
 * Manages form state, validation, and submission.
 * Prices displayed in rupees, converted to paise on submit.
 */

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { queryKeys } from '@/lib/query-keys'
import {
  EMPTY_BATCH_FORM,
  batchToForm,
  validateBatchForm,
  buildBatchPayload,
} from './batch.utils'
import type { BatchFormState, BatchFormErrors } from './batch.utils'
import type { Batch } from './batch.types'

export function useBatchForm(productId: string, existingBatch?: Batch) {
  const [form, setForm] = useState<BatchFormState>(
    existingBatch ? batchToForm(existingBatch) : EMPTY_BATCH_FORM,
  )
  const [errors, setErrors] = useState<BatchFormErrors>({})
  const toast = useToast()
  const queryClient = useQueryClient()

  const updateField = useCallback(<K extends keyof BatchFormState>(
    key: K,
    value: BatchFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }, [])

  const mutation = useMutation({
    mutationFn: async (payload: { body: Record<string, unknown>; isEdit: boolean }) => {
      if (payload.isEdit && existingBatch) {
        return api(`/batches/${existingBatch.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload.body),
        })
      }
      return api(`/products/${productId}/batches`, {
        method: 'POST',
        body: JSON.stringify(payload.body),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.batches.all() })
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Failed to save batch'
      setErrors({ batchNumber: message })
      toast.error(message)
    },
  })

  const handleSubmit = useCallback(async (): Promise<boolean> => {
    const next = validateBatchForm(form)
    setErrors(next)
    if (Object.keys(next).length > 0) return false

    try {
      const body = buildBatchPayload(form)

      if (!existingBatch && form.currentStock !== '') {
        body.currentStock = Number(form.currentStock)
      }

      await mutation.mutateAsync({ body, isEdit: Boolean(existingBatch) })
      return true
    } catch {
      return false
    }
  }, [form, existingBatch, mutation])

  const reset = useCallback(() => {
    setForm(existingBatch ? batchToForm(existingBatch) : EMPTY_BATCH_FORM)
    setErrors({})
  }, [existingBatch])

  return { form, errors, isSubmitting: mutation.isPending, updateField, handleSubmit, reset }
}
