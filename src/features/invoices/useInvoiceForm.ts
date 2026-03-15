/** Create / Edit Invoice — Form state hook
 *
 * Mirrors useProductForm.ts structure. Manages form state, per-field
 * validation, 3-section pill navigation, real-time totals via useMemo,
 * and draft/save submit paths. All amounts in PAISE.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { TIMEOUTS } from '@/config/app.config'
import { createDocument, validateStock } from './invoice.service'
import type { StockValidationItem } from './invoice.service'
import { calculateInvoiceTotals } from './invoice.utils'
import type { InvoiceTotals, LineItemCalc, ChargeCalc } from './invoice.utils'
import type {
  DocumentType,
  DocumentFormData,
  LineItemFormData,
  AdditionalChargeFormData,
  PaymentTerms,
  RoundOffSetting,
} from './invoice.types'

// ─── Section tabs ─────────────────────────────────────────────────────────────

type FormSection = 'items' | 'details' | 'charges'

// ─── Initial form state ────────────────────────────────────────────────────────

function buildInitialForm(type: DocumentType): DocumentFormData {
  return {
    type,
    status: 'DRAFT',
    partyId: '',
    documentDate: new Date().toISOString().slice(0, 10),
    paymentTerms: 'COD',
    dueDate: undefined,
    shippingAddressId: null,
    notes: '',
    termsAndConditions: '',
    includeSignature: false,
    lineItems: [],
    additionalCharges: [],
    transportDetails: null,
  }
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseInvoiceFormReturn {
  form: DocumentFormData
  errors: Record<string, string>
  isSubmitting: boolean
  activeSection: FormSection
  setActiveSection: (section: FormSection) => void
  updateField: <K extends keyof DocumentFormData>(
    key: K,
    value: DocumentFormData[K],
  ) => void
  addLineItem: (item: LineItemFormData) => void
  updateLineItem: (index: number, item: Partial<LineItemFormData>) => void
  removeLineItem: (index: number) => void
  addCharge: (charge: AdditionalChargeFormData) => void
  updateCharge: (index: number, charge: Partial<AdditionalChargeFormData>) => void
  removeCharge: (index: number) => void
  totals: InvoiceTotals
  stockWarnings: StockValidationItem[]
  hasStockBlocks: boolean
  validate: () => boolean
  handleSubmit: () => Promise<void>
  handleSaveDraft: () => Promise<void>
  reset: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInvoiceForm(
  type: DocumentType = 'SALE_INVOICE',
  roundOffSetting: RoundOffSetting = 'NONE',
): UseInvoiceFormReturn {
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState<DocumentFormData>(() => buildInitialForm(type))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  // ─── Real-time totals (recalculate on every line item / charge change) ─────

  const totals = useMemo<InvoiceTotals>(() => {
    // Map form line items to the LineItemCalc shape expected by the calculation engine.
    // purchasePricePaise defaults to 0 — the form does not collect purchase price
    // directly. The server/product lookup will enrich this on save.
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

  // ─── Stock validation (debounced, runs on line item changes) ──────────────

  const [stockWarnings, setStockWarnings] = useState<StockValidationItem[]>([])
  const stockAbortRef = useRef<AbortController | null>(null)

  const isSaleType = type === 'SALE_INVOICE' || type === 'DELIVERY_CHALLAN'

  useEffect(() => {
    // Only validate stock for outgoing documents
    if (!isSaleType || form.lineItems.length === 0) {
      setStockWarnings([])
      return
    }

    const items = form.lineItems
      .filter(li => li.productId && li.quantity > 0)
      .map(li => ({ productId: li.productId, quantity: li.quantity, unitId: li.productId }))

    if (items.length === 0) {
      setStockWarnings([])
      return
    }

    const timerId = setTimeout(() => {
      stockAbortRef.current?.abort()
      const controller = new AbortController()
      stockAbortRef.current = controller

      validateStock(items)
        .then(result => {
          if (!controller.signal.aborted) {
            setStockWarnings(result.items.filter(i => i.validation !== 'OK'))
          }
        })
        .catch(() => {
          // Silently ignore — stock validation is best-effort
        })
    }, TIMEOUTS.debounceMs)

    return () => {
      clearTimeout(timerId)
      stockAbortRef.current?.abort()
    }
  }, [form.lineItems, isSaleType]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasStockBlocks = useMemo(
    () => stockWarnings.some(w => w.validation === 'BLOCK'),
    [stockWarnings],
  )

  // ─── Validation ────────────────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {}

    if (!form.partyId) {
      next.partyId = 'Customer / supplier is required'
    }

    if (!form.documentDate) {
      next.documentDate = 'Invoice date is required'
    }

    if (form.lineItems.length === 0) {
      next.lineItems = 'At least one item is required'
    }

    form.lineItems.forEach((item, index) => {
      if (!item.productId) {
        next[`lineItems.${index}.productId`] = 'Product is required'
      }
      if (item.quantity <= 0) {
        next[`lineItems.${index}.quantity`] = 'Quantity must be greater than 0'
      }
      if (item.rate < 0) {
        next[`lineItems.${index}.rate`] = 'Rate cannot be negative'
      }
    })

    // Block if any stock items are hard-blocked
    if (hasStockBlocks) {
      next.stock = 'Some items have insufficient stock'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }, [form, hasStockBlocks])

  // ─── Submit helpers ────────────────────────────────────────────────────────

  const submitWithStatus = useCallback(async (
    targetStatus: 'SAVED' | 'DRAFT',
  ) => {
    if (targetStatus === 'SAVED' && !validate()) return
    if (isSubmitting) return

    setIsSubmitting(true)

    const payload: DocumentFormData = {
      ...form,
      status: targetStatus,
      // Normalise empty strings to undefined so the server omits them
      notes: form.notes?.trim() || undefined,
      termsAndConditions: form.termsAndConditions?.trim() || undefined,
    }

    try {
      await createDocument(payload)

      if (targetStatus === 'SAVED') {
        toast.success('Invoice saved')
        navigate(ROUTES.INVOICES)
      } else {
        toast.success('Draft saved')
      }
    } catch {
      toast.error('Failed to save invoice. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [form, isSubmitting, validate, toast, navigate])

  const handleSubmit = useCallback(async () => {
    await submitWithStatus('SAVED')
  }, [submitWithStatus])

  const handleSaveDraft = useCallback(async () => {
    await submitWithStatus('DRAFT')
  }, [submitWithStatus])

  // ─── Reset ─────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setForm(buildInitialForm(type))
    setErrors({})
    setActiveSection('items')
  }, [type])

  return {
    form,
    errors,
    isSubmitting,
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

// Re-export types needed by sub-components
export type { FormSection, PaymentTerms, DocumentType, RoundOffSetting }
