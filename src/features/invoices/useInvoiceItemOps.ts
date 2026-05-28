/** Invoice form — line-item & additional-charge mutation ops.
 * Extracted from useInvoiceForm.ts for file-size compliance.
 */

import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type {
  DocumentFormData,
  LineItemFormData,
  AdditionalChargeFormData,
} from './invoice.types'

type SetForm = Dispatch<SetStateAction<DocumentFormData>>
type SetErrors = Dispatch<SetStateAction<Record<string, string>>>

export interface InvoiceItemOps {
  addLineItem: (item: LineItemFormData) => void
  updateLineItem: (index: number, patch: Partial<LineItemFormData>) => void
  removeLineItem: (index: number) => void
  addCharge: (charge: AdditionalChargeFormData) => void
  updateCharge: (index: number, patch: Partial<AdditionalChargeFormData>) => void
  removeCharge: (index: number) => void
}

export function useInvoiceItemOps(setForm: SetForm, setErrors: SetErrors): InvoiceItemOps {
  const addLineItem = useCallback((item: LineItemFormData) => {
    setForm((prev) => ({ ...prev, lineItems: [...prev.lineItems, item] }))
    setErrors((prev) => {
      if (!prev.lineItems) return prev
      const next = { ...prev }
      delete next.lineItems
      return next
    })
  }, [setForm, setErrors])

  const updateLineItem = useCallback((index: number, patch: Partial<LineItemFormData>) => {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }, [setForm])

  const removeLineItem = useCallback((index: number) => {
    setForm((prev) => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== index) }))
  }, [setForm])

  const addCharge = useCallback((charge: AdditionalChargeFormData) => {
    setForm((prev) => ({ ...prev, additionalCharges: [...prev.additionalCharges, charge] }))
  }, [setForm])

  const updateCharge = useCallback((index: number, patch: Partial<AdditionalChargeFormData>) => {
    setForm((prev) => ({
      ...prev,
      additionalCharges: prev.additionalCharges.map((ch, i) => (i === index ? { ...ch, ...patch } : ch)),
    }))
  }, [setForm])

  const removeCharge = useCallback((index: number) => {
    setForm((prev) => ({ ...prev, additionalCharges: prev.additionalCharges.filter((_, i) => i !== index) }))
  }, [setForm])

  return { addLineItem, updateLineItem, removeLineItem, addCharge, updateCharge, removeCharge }
}
