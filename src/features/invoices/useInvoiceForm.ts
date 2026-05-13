/** Create / Edit Invoice — Form state hook
 *
 * TanStack Query v5 migration. Submit paths (save/draft) wrapped in
 * useMutation for automatic error handling and cache invalidation.
 * All amounts in PAISE.
 *
 * Pure logic (validation, initial state, payload normalization) lives in
 * invoice-form.utils.ts. Types/interfaces in invoice-form.types.ts.
 * GST Phase 2 extensions live in useGstInvoice.ts.
 */

import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { queryKeys } from '@/lib/query-keys'
import { ROUTES } from '@/config/routes.config'
import { ApiError } from '@/lib/api'
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
import type { UseInvoiceFormOptions, UseInvoiceFormReturn, FormSection, StockShortageItem } from './invoice-form.types'
import { buildInitialForm, validateInvoiceForm, normalizeFormPayload } from './invoice-form.utils'
import { useStockValidation } from './useStockValidation'
import { useGstInvoice } from './useGstInvoice'
import { useInvoiceFormBatchErrors } from './useInvoiceFormBatchErrors'

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
  const [stockShortageItems, setStockShortageItems] = useState<StockShortageItem[]>([])
  const { batchErrorCode, batchErrorLineIndex, clearBatchError, onBatchError } = useInvoiceFormBatchErrors()

  // ─── Field update ──────────────────────────────────────────────────────────

  const updateField = useCallback(<K extends keyof DocumentFormData>(
    key: K,
    value: DocumentFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key as string]) return prev
      const next = { ...prev }
      delete next[key as string]
      return next
    })
  }, [])

  // ─── Line item operations ──────────────────────────────────────────────────

  const addLineItem = useCallback((item: LineItemFormData) => {
    setForm((prev) => ({ ...prev, lineItems: [...prev.lineItems, item] }))
    setErrors((prev) => {
      if (!prev.lineItems) return prev
      const next = { ...prev }
      delete next.lineItems
      return next
    })
  }, [])

  const updateLineItem = useCallback((index: number, patch: Partial<LineItemFormData>) => {
    setForm((prev) => {
      const updated = prev.lineItems.map((item, i) => i === index ? { ...item, ...patch } : item)
      return { ...prev, lineItems: updated }
    })
  }, [])

  const removeLineItem = useCallback((index: number) => {
    setForm((prev) => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== index) }))
  }, [])

  // ─── Additional charge operations ─────────────────────────────────────────

  const addCharge = useCallback((charge: AdditionalChargeFormData) => {
    setForm((prev) => ({ ...prev, additionalCharges: [...prev.additionalCharges, charge] }))
  }, [])

  const updateCharge = useCallback((index: number, patch: Partial<AdditionalChargeFormData>) => {
    setForm((prev) => {
      const updated = prev.additionalCharges.map((ch, i) => i === index ? { ...ch, ...patch } : ch)
      return { ...prev, additionalCharges: updated }
    })
  }, [])

  const removeCharge = useCallback((index: number) => {
    setForm((prev) => ({ ...prev, additionalCharges: prev.additionalCharges.filter((_, i) => i !== index) }))
  }, [])

  // ─── Real-time totals ─────────────────────────────────────────────────────

  const totals = useMemo<InvoiceTotals>(() => {
    const lineItemCalcs: LineItemCalc[] = form.lineItems.map((item) => ({
      quantity: item.quantity,
      ratePaise: item.rate,
      discountType: item.discountType,
      discountValue: item.discountValue,
      purchasePricePaise: 0,
      isFreeItem: item.isFreeItem,
    }))
    const chargeCalcs: ChargeCalc[] = form.additionalCharges.map((charge) => ({
      type: charge.type,
      value: charge.value,
    }))
    return calculateInvoiceTotals(lineItemCalcs, chargeCalcs, roundOffSetting)
  }, [form.lineItems, form.additionalCharges, roundOffSetting])

  // ─── Stock validation ─────────────────────────────────────────────────────

  const { stockWarnings, hasStockBlocks } = useStockValidation(form.lineItems, type)
  const { gstEnabled } = useGstInvoice({
    form,
    isSubmitting: false,
    doSubmit: async () => { /* placeholder — overridden below */ },
    setLineItems: (updater) => setForm((prev) => ({ ...prev, lineItems: updater(prev.lineItems) })),
  })

  const validate = useCallback((): boolean => {
    const next = validateInvoiceForm(form, hasStockBlocks, gstEnabled)
    setErrors(next)
    return Object.keys(next).length === 0
  }, [form, hasStockBlocks, gstEnabled])

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
      setStockShortageItems([])
      clearBatchError()

      // BAT-05: WARN_ONLY — response may include expiry warnings
      const raw = result as { mode: string; targetStatus: string; editId?: string; warnings?: { type: string }[] }
      if (raw.warnings?.some((w) => w.type === 'EXPIRED_BATCH')) {
        toast.warning('Sale recorded with expired batch — review at /alerts')
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })
      if (raw.mode === 'edit' && raw.editId) {
        toast.success('Invoice updated')
        navigate(`/invoices/${raw.editId}`)
      } else if (raw.targetStatus === 'SAVED') {
        toast.success('Invoice saved')
        navigate(ROUTES.INVOICES)
      } else {
        toast.success('Draft saved')
      }
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'INSUFFICIENT_STOCK') {
        const payload = err.detail as { items?: StockShortageItem[] } | undefined
        if (payload?.items?.length) {
          setStockShortageItems(payload.items)
          setActiveSection('items')
          return
        }
      }
      // BAT-05: batch expiry 409 codes
      if (onBatchError(err)) {
        setActiveSection('items')
        return
      }
      toast.error(isEditMode ? 'Failed to update invoice.' : 'Failed to save invoice. Please try again.')
    },
  })

  const isSubmitting = submitMutation.isPending

  const doSubmitSaved = useCallback(async () => {
    await submitMutation.mutateAsync('SAVED')
  }, [submitMutation])

  // ─── GST Phase 2 extensions ───────────────────────────────────────────────

  const {
    showUntaggedDialog,
    confirmUntaggedSubmit,
    dismissUntaggedDialog,
    applyInclusivePricing,
    gstAwareSubmit,
  } = useGstInvoice({
    form,
    isSubmitting,
    doSubmit: doSubmitSaved,
    setLineItems: (updater) => setForm((prev) => ({ ...prev, lineItems: updater(prev.lineItems) })),
  })

  const submitWithStatus = useCallback(async (targetStatus: 'SAVED' | 'DRAFT') => {
    if (targetStatus === 'SAVED' && !validate()) return
    if (isSubmitting) return
    if (targetStatus === 'SAVED') {
      await gstAwareSubmit(targetStatus)
    } else {
      await submitMutation.mutateAsync(targetStatus)
    }
  }, [validate, isSubmitting, gstAwareSubmit, submitMutation])

  const handleSubmit = useCallback(async () => { await submitWithStatus('SAVED') }, [submitWithStatus])
  const handleSaveDraft = useCallback(async () => { await submitWithStatus('DRAFT') }, [submitWithStatus])

  const reset = useCallback(() => {
    setForm(initialData ?? buildInitialForm(type))
    setErrors({})
    setActiveSection('items')
    setStockShortageItems([])
  }, [type, initialData])

  const clearStockShortage = useCallback(() => setStockShortageItems([]), [])

  return {
    form, errors, isSubmitting, isEditMode, activeSection, setActiveSection,
    updateField, addLineItem, updateLineItem, removeLineItem,
    addCharge, updateCharge, removeCharge,
    totals, stockWarnings, hasStockBlocks, validate,
    handleSubmit, handleSaveDraft, reset,
    stockShortageItems, clearStockShortage,
    batchErrorCode, batchErrorLineIndex, clearBatchError,
    gstEnabled, showUntaggedDialog, confirmUntaggedSubmit, dismissUntaggedDialog, applyInclusivePricing,
  }
}

// Re-export types for consumers
export type { FormSection, UseInvoiceFormOptions, UseInvoiceFormReturn, PaymentTerms, DocumentType, RoundOffSetting } from './invoice-form.types'
