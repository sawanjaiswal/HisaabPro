/** Payment Form — Action hooks (field updates, allocation ops, discount ops)
 *
 * Extracted from usePaymentForm to keep each file under 250 lines.
 * All callbacks operate on form state via the provided setForm / setErrors.
 */

import { useCallback } from 'react'
import { calculateDiscount } from './payment.utils'
import { mergeAutoAllocated } from './paymentForm.helpers'
import type {
  PaymentMode,
  PaymentFormData,
  PaymentFormDiscount,
  PaymentDiscountType,
} from './payment.types'

// ─── Setter types (avoid importing React.Dispatch generics everywhere) ──────

type SetForm = React.Dispatch<React.SetStateAction<PaymentFormData>>
type SetErrors = React.Dispatch<React.SetStateAction<Record<string, string>>>

// ─── Return type ────────────────────────────────────────────────────────────

export interface PaymentFormActions {
  updateField: <K extends keyof PaymentFormData>(key: K, value: PaymentFormData[K]) => void
  updateMode: (mode: PaymentMode) => void
  toggleAllocation: (invoiceId: string) => void
  updateAllocationAmount: (invoiceId: string, amount: number) => void
  autoAllocate: () => void
  toggleDiscount: () => void
  updateDiscount: <K extends keyof PaymentFormDiscount>(key: K, value: PaymentFormDiscount[K]) => void
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePaymentFormActions(
  setForm: SetForm,
  setErrors: SetErrors,
): PaymentFormActions {
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
  }, [setForm, setErrors])

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
  }, [setForm, setErrors])

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
  }, [setForm])

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
  }, [setForm, setErrors])

  const autoAllocate = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      allocations: mergeAutoAllocated(prev.allocations, prev.amount),
    }))
  }, [setForm])

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
  }, [setForm])

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
  }, [setForm, setErrors])

  return {
    updateField,
    updateMode,
    toggleAllocation,
    updateAllocationAmount,
    autoAllocate,
    toggleDiscount,
    updateDiscount,
  }
}
