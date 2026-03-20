import { useState, useCallback, useRef } from 'react'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
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
  const [form, setForm] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitRef = useRef(false)

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

  const handleSubmit = useCallback(async () => {
    if (!productId || submitRef.current || !validate()) return
    submitRef.current = true
    setIsSubmitting(true)

    const body: CreateSerialData = {
      serialNumber: form.serialNumber.trim(),
      ...(form.batchId && { batchId: form.batchId }),
      ...(form.godownId && { godownId: form.godownId }),
      ...(form.notes.trim() && { notes: form.notes.trim() }),
    }

    try {
      await api<SerialNumber>(`/serial-numbers/product/${productId}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      toast.success('Serial number added')
      setForm(INITIAL)
      onSuccess?.()
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add serial number')
    } finally {
      setIsSubmitting(false)
      submitRef.current = false
    }
  }, [form, productId, validate, toast, onSuccess])

  return { form, errors, isSubmitting, updateField, handleSubmit }
}
