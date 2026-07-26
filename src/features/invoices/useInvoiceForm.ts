/** Create / Edit Invoice — Form state hook (TanStack Query v5).
 * All amounts in PAISE. Pure logic in invoice-form.utils.ts.
 * Types in invoice-form.types.ts. GST Phase 2 in useGstInvoice.ts.
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { queryKeys } from '@/lib/query-keys'
import { ROUTES } from '@/config/routes.config'
import { ApiError } from '@/lib/api'
import { useConflictReconcile, isConflictError } from '@/features/collaboration/useConflictReconcile'
import { createDocument, updateDocument } from './invoice.service'
import { calculateInvoiceTotals } from './invoice-totals.utils'
import { useInvoiceGstSummary } from './useInvoiceGstSummary'
import type { InvoiceTotals, LineItemCalc, ChargeCalc } from './invoice-calc.utils'
import type {
  DocumentType,
  DocumentFormData,
  RoundOffSetting,
} from './invoice.types'
import type { UseInvoiceFormOptions, UseInvoiceFormReturn, FormSection, StockShortageItem } from './invoice-form.types'
import { buildInitialForm, validateInvoiceForm, normalizeFormPayload } from './invoice-form.utils'
import { useInvoiceItemOps } from './useInvoiceItemOps'
import { useStockValidation } from './useStockValidation'
import { useGstInvoice } from './useGstInvoice'
import { useInvoiceFormBatchErrors } from './useInvoiceFormBatchErrors'

export function useInvoiceForm(
  type: DocumentType = 'SALE_INVOICE',
  roundOffSetting: RoundOffSetting = 'NONE',
  options: UseInvoiceFormOptions = {},
): UseInvoiceFormReturn {
  const { editId, initialData, version } = options
  const isEditMode = Boolean(editId)

  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const conflictReconcile = useConflictReconcile()
  // #150 — carries the overwrite version through the gst-aware submit chain (can't take an extra arg).
  const versionOverrideRef = useRef<number | undefined>(undefined)

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

  // ─── Line item & charge operations ─────────────────────────────────────────

  const { addLineItem, updateLineItem, removeLineItem, addCharge, updateCharge, removeCharge } =
    useInvoiceItemOps(setForm, setErrors)

  // ─── Real-time totals ─────────────────────────────────────────────────────

  // Tax is computed here, next to the totals it feeds, so the GST card and the
  // grand total can never disagree — and so the amount on screen is the amount
  // the server will store.
  const gstSummary = useInvoiceGstSummary(form.lineItems, form.placeOfSupply, form.taxPricingMode)
  const totalTax = gstSummary?.summary.totalTax ?? 0

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
    return calculateInvoiceTotals(lineItemCalcs, chargeCalcs, roundOffSetting, totalTax)
  }, [form.lineItems, form.additionalCharges, roundOffSetting, totalTax])

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
        await updateDocument(editId, payload, versionOverrideRef.current ?? version)
        return { mode: 'edit' as const, targetStatus, editId }
      }
      // Payment-at-creation: attach the received amount only when the user
      // actually collected money (the server records it via createPayment and
      // ignores it for drafts / non-sale docs).
      const createPayload = form.payment.amountReceived > 0
        ? { ...payload, payment: form.payment }
        : payload
      await createDocument(createPayload)
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
      // #150 — a CONFLICT opens the reconcile dialog (handled below), not a toast.
      if (isConflictError(err)) return
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

  const submitWithStatus = useCallback(async (targetStatus: 'SAVED' | 'DRAFT', versionOverride?: number) => {
    if (targetStatus === 'SAVED' && !validate()) return
    if (isSubmitting) return
    versionOverrideRef.current = versionOverride
    try {
      if (targetStatus === 'SAVED') {
        await gstAwareSubmit(targetStatus)
      } else {
        await submitMutation.mutateAsync(targetStatus)
      }
    } catch (err) {
      if (isConflictError(err)) throw err // #150 — let withConflictGuard open the dialog; others already toasted
    } finally {
      versionOverrideRef.current = undefined
    }
  }, [validate, isSubmitting, gstAwareSubmit, submitMutation])

  const { withConflictGuard } = conflictReconcile
  const handleSubmit = useCallback(() => withConflictGuard((v) => submitWithStatus('SAVED', v)), [submitWithStatus, withConflictGuard])
  const handleSaveDraft = useCallback(() => withConflictGuard((v) => submitWithStatus('DRAFT', v)), [submitWithStatus, withConflictGuard])

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
    totals, gstSummary, stockWarnings, hasStockBlocks, validate,
    handleSubmit, handleSaveDraft, reset,
    stockShortageItems, clearStockShortage,
    batchErrorCode, batchErrorLineIndex, clearBatchError,
    gstEnabled, showUntaggedDialog, confirmUntaggedSubmit, dismissUntaggedDialog, applyInclusivePricing,
    priceListId: form.priceListId ?? null, // Epic B PR2 override
    conflictReconcile,
  }
}

// Re-export types for consumers
export type { FormSection, UseInvoiceFormOptions, UseInvoiceFormReturn, PaymentTerms, DocumentType, RoundOffSetting } from './invoice-form.types'
