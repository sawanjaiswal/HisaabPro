import { useState, useCallback, useRef } from 'react'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { BULK_CREATE_MAX } from './serial-number.constants'
import { parseSerialNumbers } from './serial-number.utils'
import type { BulkCreateResult, BulkCreateSerialData } from './serial-number.types'

interface FormState {
  text: string
  batchId: string
  godownId: string
}

const INITIAL: FormState = { text: '', batchId: '', godownId: '' }

export function useBulkSerialForm(productId: string, onSuccess?: () => void) {
  const toast = useToast()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<BulkCreateResult | null>(null)
  const submitRef = useRef(false)

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors({})
    setResult(null)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!productId || submitRef.current) return

    const serials = parseSerialNumbers(form.text)
    if (serials.length === 0) {
      setErrors({ text: 'Enter at least one serial number' })
      return
    }
    if (serials.length > BULK_CREATE_MAX) {
      setErrors({ text: `Maximum ${BULK_CREATE_MAX} serial numbers at a time` })
      return
    }

    submitRef.current = true
    setIsSubmitting(true)

    const body: BulkCreateSerialData = {
      serialNumbers: serials,
      ...(form.batchId && { batchId: form.batchId }),
      ...(form.godownId && { godownId: form.godownId }),
    }

    try {
      const res = await api<BulkCreateResult>(`/serial-numbers/product/${productId}/bulk`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setResult(res)
      if (res.errors.length === 0) {
        toast.success(`${res.created} serial numbers added`)
        setForm(INITIAL)
        onSuccess?.()
      } else {
        toast.warning(`${res.created} added, ${res.errors.length} failed`)
      }
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Bulk create failed')
    } finally {
      setIsSubmitting(false)
      submitRef.current = false
    }
  }, [form, productId, toast, onSuccess])

  return { form, errors, isSubmitting, result, updateField, handleSubmit }
}
