/** Batch Tracking — Form hook (create + edit)
 *
 * Manages form state, validation, and submission.
 * Prices displayed in rupees, converted to paise on submit.
 */

import { useState, useCallback } from 'react'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
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
    existingBatch ? batchToForm(existingBatch) : EMPTY_BATCH_FORM
  )
  const [errors, setErrors] = useState<BatchFormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const toast = useToast()

  const updateField = useCallback(<K extends keyof BatchFormState>(
    key: K,
    value: BatchFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }, [])

  const handleSubmit = useCallback(async (): Promise<boolean> => {
    const next = validateBatchForm(form)
    setErrors(next)
    if (Object.keys(next).length > 0) return false

    setIsSubmitting(true)
    try {
      const body = buildBatchPayload(form)

      if (existingBatch) {
        await api(`/batches/${existingBatch.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      } else {
        if (form.currentStock !== '') body.currentStock = Number(form.currentStock)
        await api(`/products/${productId}/batches`, {
          method: 'POST',
          body: JSON.stringify(body),
        })
      }

      return true
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Failed to save batch'
      setErrors({ batchNumber: message })
      toast.error(message)
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [form, existingBatch, productId, toast])

  const reset = useCallback(() => {
    setForm(existingBatch ? batchToForm(existingBatch) : EMPTY_BATCH_FORM)
    setErrors({})
  }, [existingBatch])

  return { form, errors, isSubmitting, updateField, handleSubmit, reset }
}
