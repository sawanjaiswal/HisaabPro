/** Create / Edit Payment — Form state hook
 *
 * Manages form state, per-field validation, 3-section pill navigation,
 * invoice allocation (manual + FIFO auto), and discount section.
 * Mirrors useInvoiceForm.ts structure. All amounts in PAISE.
 */

import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { createPayment, updatePayment } from './payment.service'
import { validatePaymentForm, autoAllocateFIFO, calculateDiscount } from './payment.utils'
import type {
  PaymentType,
  PaymentMode,
  PaymentFormData,
  PaymentFormDiscount,
  PaymentFormSection,
  PaymentDetail,
  PaymentDiscountType,
} from './payment.types'

// ─── Initial form state ────────────────────────────────────────────────────────

function buildInitialForm(type: PaymentType): PaymentFormData {
  return {
    type,
    partyId: '',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    mode: 'CASH',
    referenceNumber: '',
    notes: '',
    allocations: [],
    discount: null,
  }
}

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

  const isEditMode = payment !== null

  const [form, setForm] = useState<PaymentFormData>(() => {
    if (payment !== null) {
      // Pre-populate from existing PaymentDetail
      return {
        type: payment.type,
        partyId: payment.partyId,
        amount: payment.amount,
        date: payment.date,
        mode: payment.mode,
        referenceNumber: payment.referenceNumber ?? '',
        notes: payment.notes ?? '',
        allocations: payment.allocations.map((a) => ({
          invoiceId: a.invoiceId,
          invoiceNumber: a.invoiceNumber,
          // In edit mode we don't know invoiceDue from the allocation shape alone;
          // components should enrich this from the outstanding API if needed.
          invoiceDue: a.amount,
          amount: a.amount,
          selected: true,
        })),
        discount: payment.discount !== null
          ? {
              type: payment.discount.type,
              value: payment.discount.value,
              calculatedAmount: payment.discount.calculatedAmount,
              reason: payment.discount.reason ?? '',
            }
          : null,
      }
    }
    return buildInitialForm(defaultType)
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState<PaymentFormSection>('details')

  // ─── Generic field update ──────────────────────────────────────────────────

  const updateField = useCallback(<K extends keyof PaymentFormData>(
    key: K,
    value: PaymentFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))

    // Clear field error on change
    setErrors((prev) => {
      if (!prev[key as string]) return prev
      const next = { ...prev }
      delete next[key as string]
      return next
    })
  }, [])

  // ─── Mode update — clears referenceNumber for CASH ────────────────────────

  const updateMode = useCallback((mode: PaymentMode) => {
    setForm((prev) => ({
      ...prev,
      mode,
      // Reference is meaningless for cash payments — clear it on switch
      referenceNumber: mode === 'CASH' ? '' : prev.referenceNumber,
    }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next.mode
      delete next.referenceNumber
      return next
    })
  }, [])

  // ─── Allocation operations ─────────────────────────────────────────────────

  const toggleAllocation = useCallback((invoiceId: string) => {
    setForm((prev) => ({
      ...prev,
      allocations: prev.allocations.map((a) =>
        a.invoiceId === invoiceId
          ? { ...a, selected: !a.selected, amount: !a.selected ? 0 : a.amount }
          : a,
      ),
    }))
  }, [])

  const updateAllocationAmount = useCallback((invoiceId: string, amount: number) => {
    setForm((prev) => ({
      ...prev,
      allocations: prev.allocations.map((a) =>
        a.invoiceId === invoiceId ? { ...a, amount } : a,
      ),
    }))
    setErrors((prev) => {
      if (!prev.allocations) return prev
      const next = { ...prev }
      delete next.allocations
      return next
    })
  }, [])

  const autoAllocate = useCallback(() => {
    setForm((prev) => {
      const selected = prev.allocations.filter((a) => a.selected)
      const unselected = prev.allocations.filter((a) => !a.selected)
      const allocated = autoAllocateFIFO(prev.amount, selected)
      // Merge back in original order
      const merged = prev.allocations.map((a) => {
        const found = allocated.find((x) => x.invoiceId === a.invoiceId)
        const unsel = unselected.find((x) => x.invoiceId === a.invoiceId)
        return found ?? unsel ?? a
      })
      return { ...prev, allocations: merged }
    })
  }, [])

  // ─── Discount operations ───────────────────────────────────────────────────

  const toggleDiscount = useCallback(() => {
    setForm((prev) => {
      if (prev.discount !== null) {
        // Disable: remove discount section
        return { ...prev, discount: null }
      }
      // Enable: start with zero PERCENTAGE discount
      const initial: PaymentFormDiscount = {
        type: 'PERCENTAGE',
        value: 0,
        calculatedAmount: 0,
        reason: '',
      }
      return { ...prev, discount: initial }
    })
  }, [])

  const updateDiscount = useCallback(<K extends keyof PaymentFormDiscount>(
    key: K,
    value: PaymentFormDiscount[K],
  ) => {
    setForm((prev) => {
      if (prev.discount === null) return prev

      const updated: PaymentFormDiscount = { ...prev.discount, [key]: value }

      // Recalculate derived amount whenever type or value changes
      if (key === 'type' || key === 'value') {
        updated.calculatedAmount = calculateDiscount(
          updated.type as PaymentDiscountType,
          updated.value as number,
          prev.amount,
        )
      }

      return { ...prev, discount: updated }
    })

    setErrors((prev) => {
      const next = { ...prev }
      delete next[`discount.${key as string}`]
      return next
    })
  }, [])

  // ─── Derived allocation total for submit payload ───────────────────────────

  const selectedAllocations = useMemo(
    () => form.allocations.filter((a) => a.selected && a.amount > 0),
    [form.allocations],
  )

  // ─── Validation ────────────────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    const payload: PaymentFormData = {
      ...form,
      allocations: selectedAllocations,
    }
    const next = validatePaymentForm(payload)
    setErrors(next)
    return Object.keys(next).length === 0
  }, [form, selectedAllocations])

  // ─── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!validate()) return
    if (isSubmitting) return

    setIsSubmitting(true)

    // Build API payload — strip client-only fields from allocations
    const apiAllocations = selectedAllocations.map(({ invoiceId, amount }) => ({
      invoiceId,
      amount,
    }))

    const apiPayload = {
      type: form.type,
      partyId: form.partyId,
      amount: form.amount,
      date: form.date,
      mode: form.mode,
      referenceNumber: form.referenceNumber.trim() || undefined,
      notes: form.notes.trim() || undefined,
      allocations: apiAllocations,
      discount: form.discount !== null && form.discount.value > 0
        ? {
            type: form.discount.type,
            value: form.discount.value,
            reason: form.discount.reason.trim() || undefined,
          }
        : undefined,
    }

    try {
      if (isEditMode && payment !== null) {
        await updatePayment(payment.id, apiPayload as unknown as PaymentFormData)
        toast.success('Payment updated')
        navigate(ROUTES.PAYMENT_DETAIL.replace(':id', payment.id))
      } else {
        await createPayment(apiPayload as unknown as PaymentFormData)
        toast.success('Payment recorded')
        navigate(ROUTES.PAYMENTS)
      }
    } catch {
      toast.error('Failed to save payment. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [form, isSubmitting, isEditMode, payment, selectedAllocations, validate, toast, navigate])

  return {
    form,
    errors,
    isSubmitting,
    activeSection,
    setActiveSection,
    updateField,
    updateMode,
    toggleAllocation,
    updateAllocationAmount,
    autoAllocate,
    toggleDiscount,
    updateDiscount,
    validate,
    handleSubmit,
  }
}

// Re-export types needed by sub-components
export type { PaymentFormSection, PaymentType, PaymentMode }
