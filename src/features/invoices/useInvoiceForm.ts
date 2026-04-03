/** Create / Edit Invoice — Form state hook
 *
 * TanStack Query v5 migration. Submit paths (save/draft) wrapped in
 * useMutation for automatic error handling and cache invalidation.
 * All amounts in PAISE.
 *
 * Pure logic (validation, initial state, payload normalization) lives in
 * invoice-form.utils.ts. Types/interfaces in invoice-form.types.ts.
 */

import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { queryKeys } from '@/lib/query-keys'
import { ROUTES } from '@/config/routes.config'
import { createDocument, updateDocument } from './invoice.service'
import { calculateInvoiceTotals } from './invoice-totals.utils'
import type { InvoiceTotals, LineItemCalc, ChargeCalc } from './invoice-calc.utils'
import type {
  DocumentType,
  DocumentFormData,
  LineItemFormData,
  AdditionalChargeFormData,
  RoundOffSetting,
} from './invoice.types'
import type { UseInvoiceFormOptions, UseInvoiceFormReturn, FormSection } from './invoice-form.types'
import { buildInitialForm, validateInvoiceForm, normalizeFormPayload } from './invoice-form.utils'
import { useStockValidation } from './useStockValidation'

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInvoiceForm(
  type: DocumentType = 'SALE_INVOICE',
  roundOffSetting: RoundOffSetting = 'NONE',
  options: UseInvoiceFormOptions = {},
): UseInvoiceFormReturn {
  const { editId, initialData } = options
  const isEditMode = Boolean(editId)

  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<DocumentFormData>(() => initialData ?? buildInitialForm(type))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeSection, setActiveSection] = useState<FormSection>('items')

  // ─── Field update ──────────────────────────────────────────────────────────

  const updateField = useCallback(<K extends keyof DocumentFormData>(
    key: K,
    value: DocumentFormData[K],
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

  // ─── Line item operations ──────────────────────────────────────────────────

  const addLineItem = useCallback((item: LineItemFormData) => {
    setForm((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, item],
    }))

    // Clear line item error when at least one item is added
    setErrors((prev) => {
      if (!prev.lineItems) return prev
      const next = { ...prev }
      delete next.lineItems
      return next
    })
  }, [])

  const updateLineItem = useCallback((index: number, patch: Partial<LineItemFormData>) => {
    setForm((prev) => {
      const updated = prev.lineItems.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      )
      return { ...prev, lineItems: updated }
    })
  }, [])

  const removeLineItem = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index),
    }))
  }, [])

  // ─── Additional charge operations ─────────────────────────────────────────

  const addCharge = useCallback((charge: AdditionalChargeFormData) => {
    setForm((prev) => ({
      ...prev,
      additionalCharges: [...prev.additionalCharges, charge],
    }))
  }, [])

  const updateCharge = useCallback((
    index: number,
    patch: Partial<AdditionalChargeFormData>,
  ) => {
    setForm((prev) => {
      const updated = prev.additionalCharges.map((charge, i) =>
        i === index ? { ...charge, ...patch } : charge,
      )
      return { ...prev, additionalCharges: updated }
    })
  }, [])

  const removeCharge = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      additionalCharges: prev.additionalCharges.filter((_, i) => i !== index),
    }))
  }, [])

  // ─── Real-time totals ─────────────────────────────────────────────────────

  const totals = useMemo<InvoiceTotals>(() => {
    const lineItemCalcs: LineItemCalc[] = form.lineItems.map((item) => ({
      quantity: item.quantity,
      ratePaise: item.rate,
      discountType: item.discountType,
      discountValue: item.discountValue,
      purchasePricePaise: 0,
    }))

    const chargeCalcs: ChargeCalc[] = form.additionalCharges.map((charge) => ({
      type: charge.type,
      value: charge.value,
    }))

    return calculateInvoiceTotals(lineItemCalcs, chargeCalcs, roundOffSetting)
  }, [form.lineItems, form.additionalCharges, roundOffSetting])

  // ─── Stock validation (debounced, via dedicated hook) ─────────────────────

  const { stockWarnings, hasStockBlocks } = useStockValidation(form.lineItems, type)

  // ─── Validation ───────────────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    const next = validateInvoiceForm(form, hasStockBlocks)
    setErrors(next)
    return Object.keys(next).length === 0
  }, [form, hasStockBlocks])

  // ─── Submit mutation ──────────────────────────────────────────────────────

  const submitMutation = useMutation({
    mutationFn: async (targetStatus: 'SAVED' | 'DRAFT') => {
      const payload = normalizeFormPayload(form, targetStatus)
      if (isEditMode && editId) {
        await updateDocument(editId, payload)
        return { mode: 'edit' as const, targetStatus, editId }
      }
      await createDocument(payload)
      return { mode: 'create' as const, targetStatus }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })

      if (result.mode === 'edit') {
        toast.success('Invoice updated')
        navigate(`/invoices/${result.editId}`)
      } else if (result.targetStatus === 'SAVED') {
        toast.success('Invoice saved')
        navigate(ROUTES.INVOICES)
      } else {
        toast.success('Draft saved')
      }
    },
    onError: () => {
      toast.error(isEditMode ? 'Failed to update invoice.' : 'Failed to save invoice. Please try again.')
    },
  })

  const isSubmitting = submitMutation.isPending

  const submitWithStatus = useCallback(async (
    targetStatus: 'SAVED' | 'DRAFT',
  ) => {
    if (targetStatus === 'SAVED' && !validate()) return
    if (isSubmitting) return
    await submitMutation.mutateAsync(targetStatus)
  }, [validate, isSubmitting, submitMutation])

  const handleSubmit = useCallback(async () => {
    await submitWithStatus('SAVED')
  }, [submitWithStatus])

  const handleSaveDraft = useCallback(async () => {
    await submitWithStatus('DRAFT')
  }, [submitWithStatus])

  // ─── Reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setForm(initialData ?? buildInitialForm(type))
    setErrors({})
    setActiveSection('items')
  }, [type, initialData])

  return {
    form,
    errors,
    isSubmitting,
    isEditMode,
    activeSection,
    setActiveSection,
    updateField,
    addLineItem,
    updateLineItem,
    removeLineItem,
    addCharge,
    updateCharge,
    removeCharge,
    totals,
    stockWarnings,
    hasStockBlocks,
    validate,
    handleSubmit,
    handleSaveDraft,
    reset,
  }
}

// Re-export types for consumers
export type { FormSection, UseInvoiceFormOptions, UseInvoiceFormReturn } from './invoice-form.types'
export type { PaymentTerms, DocumentType, RoundOffSetting } from './invoice-form.types'
