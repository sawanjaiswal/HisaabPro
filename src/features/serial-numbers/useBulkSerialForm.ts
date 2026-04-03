import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [result, setResult] = useState<BulkCreateResult | null>(null)

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors({})
    setResult(null)
  }, [])

  const mutation = useMutation({
    mutationFn: (body: BulkCreateSerialData) =>
      api<BulkCreateResult>(`/serial-numbers/product/${productId}/bulk`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (res) => {
      setResult(res)
      void queryClient.invalidateQueries({ queryKey: queryKeys.serialNumbers.all() })
      if (res.errors.length === 0) {
        toast.success(`${res.created} serial numbers added`)
        setForm(INITIAL)
        onSuccess?.()
      } else {
        toast.warning(`${res.created} added, ${res.errors.length} failed`)
      }
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'Bulk create failed')
    },
  })

  const handleSubmit = useCallback(async () => {
    if (!productId || mutation.isPending) return

    const serials = parseSerialNumbers(form.text)
    if (serials.length === 0) {
      setErrors({ text: 'Enter at least one serial number' })
      return
    }
    if (serials.length > BULK_CREATE_MAX) {
      setErrors({ text: `Maximum ${BULK_CREATE_MAX} serial numbers at a time` })
      return
    }

    const body: BulkCreateSerialData = {
      serialNumbers: serials,
      ...(form.batchId && { batchId: form.batchId }),
      ...(form.godownId && { godownId: form.godownId }),
    }

    await mutation.mutateAsync(body)
  }, [form, productId, mutation])

  return { form, errors, isSubmitting: mutation.isPending, result, updateField, handleSubmit }
}
