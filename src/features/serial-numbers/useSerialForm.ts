import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { queryKeys } from '@/lib/query-keys'
import { SERIAL_NUMBER_MAX, NOTES_MAX } from './serial-number.constants'
import type { CreateSerialData, SerialNumber } from './serial-number.types'

interface FormState {
  serialNumber: string
  batchId: string
  godownId: string
  notes: string
}

const INITIAL: FormState = { serialNumber: '', batchId: '', godownId: '', notes: '' }

export function useSerialForm(productId: string, onSuccess?: () => void) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }, [])

  const validate = useCallback((): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}
    if (!form.serialNumber.trim()) next.serialNumber = 'Serial number is required'
    else if (form.serialNumber.length > SERIAL_NUMBER_MAX) next.serialNumber = `Max ${SERIAL_NUMBER_MAX} characters`
    if (form.notes.length > NOTES_MAX) next.notes = `Max ${NOTES_MAX} characters`
    setErrors(next)
    return Object.keys(next).length === 0
  }, [form])

  const mutation = useMutation({
    mutationFn: (body: CreateSerialData) =>
      api<SerialNumber>(`/serial-numbers/product/${productId}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success('Serial number added')
      setForm(INITIAL)
      void queryClient.invalidateQueries({ queryKey: queryKeys.serialNumbers.all() })
      onSuccess?.()
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add serial number')
    },
  })

  const handleSubmit = useCallback(async () => {
    if (!productId || mutation.isPending || !validate()) return

    const body: CreateSerialData = {
      serialNumber: form.serialNumber.trim(),
      ...(form.batchId && { batchId: form.batchId }),
      ...(form.godownId && { godownId: form.godownId }),
      ...(form.notes.trim() && { notes: form.notes.trim() }),
    }

    await mutation.mutateAsync(body)
  }, [form, productId, validate, mutation])

  return { form, errors, isSubmitting: mutation.isPending, updateField, handleSubmit }
}
