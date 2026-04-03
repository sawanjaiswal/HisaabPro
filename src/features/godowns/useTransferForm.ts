/** Stock transfer -- Form hook */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { api, ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { ROUTES } from '@/config/routes.config'
import { TRANSFER_NOTES_MAX } from './godown.constants'
import type { TransferStockData } from './godown.types'

interface UseTransferFormReturn {
  form: TransferStockData
  errors: Record<string, string>
  isSubmitting: boolean
  updateField: <K extends keyof TransferStockData>(key: K, value: TransferStockData[K]) => void
  handleSubmit: () => Promise<void>
}

const INITIAL_FORM: TransferStockData = {
  productId: '',
  fromGodownId: '',
  toGodownId: '',
  quantity: 0,
  batchId: '',
  notes: '',
}

export function useTransferForm(): UseTransferFormReturn {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<TransferStockData>(INITIAL_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const updateField = useCallback(<K extends keyof TransferStockData>(key: K, value: TransferStockData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key as string]) return prev
      const next = { ...prev }
      delete next[key as string]
      return next
    })
  }, [])

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {}

    if (!form.productId) next.productId = 'Select a product'
    if (!form.fromGodownId) next.fromGodownId = 'Select source godown'
    if (!form.toGodownId) next.toGodownId = 'Select destination godown'
    if (form.fromGodownId && form.toGodownId && form.fromGodownId === form.toGodownId) {
      next.toGodownId = 'Source and destination must be different'
    }
    if (!form.quantity || form.quantity <= 0) {
      next.quantity = 'Quantity must be greater than 0'
    } else if (!Number.isInteger(form.quantity)) {
      next.quantity = 'Quantity must be a whole number'
    }
    if (form.notes && form.notes.length > TRANSFER_NOTES_MAX) {
      next.notes = `Notes must be under ${TRANSFER_NOTES_MAX} characters`
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }, [form])

  const mutation = useMutation({
    mutationFn: (payload: TransferStockData) =>
      api('/godowns/transfer', {
        method: 'POST',
        body: JSON.stringify(payload),
        entityType: 'transfer',
        entityLabel: 'Stock transfer',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.godowns.all() })
      toast.success('Stock transferred successfully')
      navigate(ROUTES.GODOWNS)
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Failed to transfer stock'
      toast.error(message)
    },
  })

  const handleSubmit = useCallback(async () => {
    if (!validate() || mutation.isPending) return

    const payload: TransferStockData = {
      productId: form.productId,
      fromGodownId: form.fromGodownId,
      toGodownId: form.toGodownId,
      quantity: form.quantity,
      batchId: form.batchId || undefined,
      notes: form.notes?.trim() || undefined,
    }

    await mutation.mutateAsync(payload)
  }, [form, mutation, validate])

  return { form, errors, isSubmitting: mutation.isPending, updateField, handleSubmit }
}
