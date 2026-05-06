/** useRecurringForm — form state + create/update mutations for recurring schedules */

import { useState, useCallback, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { toLocalISODate } from '@/lib/format'
import { createRecurring, getRecurring, updateRecurring } from '../recurring.service'
import type { RecurringFrequency, CreateRecurringInput } from '../recurring.types'

export interface RecurringFormState {
  name: string
  templateDocumentId: string
  frequency: RecurringFrequency
  dayOfMonth: string
  dayOfWeek: string
  startDate: string
  endDate: string
  autoSend: boolean
  autoPaymentLink: boolean
  autoReminder: boolean
}

export interface FormErrors {
  name?: string
  templateDocumentId?: string
  startDate?: string
  endDate?: string
}

const defaultState = (): RecurringFormState => ({
  name: '',
  templateDocumentId: '',
  frequency: 'MONTHLY',
  dayOfMonth: '1',
  dayOfWeek: '1',
  startDate: toLocalISODate(new Date()),
  endDate: '',
  autoSend: false,
  autoPaymentLink: false,
  autoReminder: false,
})

function validate(state: RecurringFormState): FormErrors {
  const errors: FormErrors = {}
  if (!state.templateDocumentId.trim()) {
    errors.templateDocumentId = 'recurringFormValidationRequired'
  }
  if (!state.startDate) {
    errors.startDate = 'recurringFormValidationRequired'
  }
  if (state.endDate && state.startDate && state.endDate <= state.startDate) {
    errors.endDate = 'recurringFormValidationEndDate'
  }
  return errors
}

interface UseRecurringFormOptions {
  scheduleId?: string
  fromInvoiceId?: string | null
}

export function useRecurringForm({ scheduleId, fromInvoiceId }: UseRecurringFormOptions) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const isEdit = Boolean(scheduleId)

  const [form, setForm] = useState<RecurringFormState>(defaultState)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  const existingQuery = useQuery({
    queryKey: queryKeys.recurring.detail(scheduleId ?? ''),
    queryFn: ({ signal }) => getRecurring(scheduleId ?? '', signal),
    enabled: isEdit && Boolean(scheduleId),
  })

  // Hydrate form when loading edit data
  useEffect(() => {
    if (existingQuery.data) {
      const s = existingQuery.data
      setForm({
        name: s.name ?? '',
        templateDocumentId: s.templateDocumentId,
        frequency: s.frequency,
        dayOfMonth: String(s.dayOfMonth ?? 1),
        dayOfWeek: String(s.dayOfWeek ?? 1),
        startDate: s.startDate.slice(0, 10),
        endDate: s.endDate ? s.endDate.slice(0, 10) : '',
        autoSend: s.autoSend,
        autoPaymentLink: s.autoPaymentLink,
        autoReminder: s.autoReminder,
      })
    }
  }, [existingQuery.data])

  // Pre-fill templateDocumentId from query param (fromInvoiceId)
  useEffect(() => {
    if (fromInvoiceId && !isEdit) {
      setForm((prev) => ({ ...prev, templateDocumentId: fromInvoiceId }))
    }
  }, [fromInvoiceId, isEdit])

  const setField = useCallback(<K extends keyof RecurringFormState>(
    key: K,
    value: RecurringFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (submitted) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }, [submitted])

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all() })
  }, [queryClient])

  const createMutation = useMutation({
    mutationFn: (input: CreateRecurringInput) => createRecurring(input),
    onSuccess: () => {
      const online = navigator.onLine
      if (!online) {
        toast.success('recurringFormOfflineToast')
      }
      invalidate()
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : 'Failed to create schedule.'
      toast.error(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (input: CreateRecurringInput) =>
      updateRecurring(scheduleId ?? '', input, input.name ?? 'Recurring schedule'),
    onSuccess: () => {
      invalidate()
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : 'Failed to update schedule.'
      toast.error(msg)
    },
  })

  const buildInput = useCallback((): CreateRecurringInput => {
    const input: CreateRecurringInput = {
      templateDocumentId: form.templateDocumentId.trim(),
      frequency: form.frequency,
      startDate: form.startDate,
      ...(form.endDate ? { endDate: form.endDate } : {}),
      ...(form.name.trim() ? { name: form.name.trim() } : {}),
      autoSend: form.autoSend,
      autoPaymentLink: form.autoPaymentLink,
      autoReminder: form.autoReminder,
    }
    if (form.frequency === 'WEEKLY') {
      input.dayOfWeek = Number(form.dayOfWeek)
    } else if (form.frequency !== 'DAILY') {
      input.dayOfMonth = Math.min(Number(form.dayOfMonth), 28)
    }
    return input
  }, [form])

  const submit = useCallback(async (): Promise<string | null> => {
    setSubmitted(true)
    const errs = validate(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return null
    }
    const input = buildInput()
    if (isEdit) {
      await updateMutation.mutateAsync(input)
      return scheduleId ?? null
    } else {
      const result = await createMutation.mutateAsync(input)
      // result may be {} when offline
      return (result as { id?: string }).id ?? null
    }
  }, [form, buildInput, isEdit, createMutation, updateMutation, scheduleId])

  return {
    form,
    setField,
    errors,
    submit,
    isLoading: existingQuery.isPending && isEdit,
    isError: existingQuery.isError && isEdit,
    isSaving: createMutation.isPending || updateMutation.isPending,
    isEdit,
  }
}
