/** Create / Edit Payment — Form state hook
 *
 * TanStack Query v5 migration. Submit wrapped in useMutation for
 * automatic error handling and cache invalidation. Manages form state,
 * per-field validation, 3-section pill navigation, invoice allocation
 * (manual + FIFO auto), and discount section. All amounts in PAISE.
 *
 * Actions (field updates, allocation ops, discount ops) are in usePaymentFormActions.ts.
 * Pure helpers (initial state, API payload, merge logic) are in paymentForm.helpers.ts.
 */

import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { queryKeys } from '@/lib/query-keys'
import { ROUTES } from '@/config/routes.config'
import { createPayment, updatePayment } from './payment.service'
import { validatePaymentForm } from './payment.utils'
import { buildInitialForm, buildFormFromPayment, buildApiPayload } from './paymentForm.helpers'
import { usePaymentFormActions } from './usePaymentFormActions'
import type {
  PaymentType,
  PaymentMode,
  PaymentFormData,
  PaymentFormDiscount,
  PaymentFormSection,
  PaymentDetail,
} from './payment.types'

// ─── Options ──────────────────────────────────────────────────────────────────

interface UsePaymentFormOptions {
  /** Existing payment for edit mode. When provided the form is pre-populated. */
  payment?: PaymentDetail | null
  /** Default direction when creating a new payment. Defaults to 'PAYMENT_IN'. */
  defaultType?: PaymentType
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UsePaymentFormReturn {
  form: PaymentFormData
  errors: Record<string, string>
  isSubmitting: boolean
  activeSection: PaymentFormSection
  setActiveSection: (section: PaymentFormSection) => void
  updateField: <K extends keyof PaymentFormData>(key: K, value: PaymentFormData[K]) => void
  updateMode: (mode: PaymentMode) => void
  toggleAllocation: (invoiceId: string) => void
  updateAllocationAmount: (invoiceId: string, amount: number) => void
  autoAllocate: () => void
  toggleDiscount: () => void
  updateDiscount: <K extends keyof PaymentFormDiscount>(key: K, value: PaymentFormDiscount[K]) => void
  validate: () => boolean
  handleSubmit: () => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePaymentForm({
  payment = null,
  defaultType = 'PAYMENT_IN',
}: UsePaymentFormOptions = {}): UsePaymentFormReturn {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const isEditMode = payment !== null

  const [form, setForm] = useState<PaymentFormData>(() =>
    payment !== null ? buildFormFromPayment(payment) : buildInitialForm(defaultType),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeSection, setActiveSection] = useState<PaymentFormSection>('details')

  // ─── Delegate field / allocation / discount actions ──────────────────────

  const actions = usePaymentFormActions(setForm, setErrors)

  // ─── Derived allocation total for submit payload ─────────────────────────

  const selectedAllocations = useMemo(
    () => form.allocations.filter((a) => a.selected && a.amount > 0),
    [form.allocations],
  )

  // ─── Validation ──────────────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    const payload: PaymentFormData = {
      ...form,
      allocations: selectedAllocations,
    }
    const next = validatePaymentForm(payload)
    setErrors(next)
    return Object.keys(next).length === 0
  }, [form, selectedAllocations])

  // ─── Submit mutation ──────────────────────────────────────────────────────

  const submitMutation = useMutation({
    mutationFn: async () => {
      const apiPayload = buildApiPayload(form, selectedAllocations)
      if (isEditMode && payment !== null) {
        await updatePayment(payment.id, apiPayload as unknown as PaymentFormData)
        return { mode: 'edit' as const, paymentId: payment.id }
      }
      await createPayment(apiPayload as unknown as PaymentFormData)
      return { mode: 'create' as const }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() })
      // Also invalidate invoices since payment allocation changes outstanding
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })

      if (result.mode === 'edit') {
        toast.success('Payment updated')
        navigate(ROUTES.PAYMENT_DETAIL.replace(':id', result.paymentId))
      } else {
        toast.success('Payment recorded')
        navigate(ROUTES.PAYMENTS)
      }
    },
    onError: () => {
      toast.error('Failed to save payment. Please try again.')
    },
  })

  const isSubmitting = submitMutation.isPending

  const handleSubmit = useCallback(async () => {
    if (!validate()) return
    if (isSubmitting) return
    await submitMutation.mutateAsync()
  }, [validate, isSubmitting, submitMutation])

  return {
    form,
    errors,
    isSubmitting,
    activeSection,
    setActiveSection,
    ...actions,
    validate,
    handleSubmit,
  }
}

// Re-export types needed by sub-components
export type { PaymentFormSection, PaymentType, PaymentMode }
