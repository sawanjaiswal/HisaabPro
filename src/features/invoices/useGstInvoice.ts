/** GST Invoice Extensions — hook for GST-specific invoice form state
 *
 * Extracted from useInvoiceForm to stay within 250-line limit.
 * Handles: untagged-tax dialog, inclusive pricing back-calc.
 */

import { useState, useCallback } from 'react'
import { useGstGate } from '@/features/gst/useGstGate'
import { backCalculateInclusive } from '@/features/tax/tax-calc.utils'
import { hasUntaggedTaxLines } from './invoice-form.utils'
import type { DocumentFormData, LineItemFormData } from './invoice.types'

interface UseGstInvoiceOptions {
  form: DocumentFormData
  isSubmitting: boolean
  doSubmit: () => Promise<void>
  setLineItems: (updater: (prev: LineItemFormData[]) => LineItemFormData[]) => void
}

export interface GstInvoiceExtensions {
  gstEnabled: boolean
  showUntaggedDialog: boolean
  confirmUntaggedSubmit: () => Promise<void>
  dismissUntaggedDialog: () => void
  applyInclusivePricing: (taxRateBP: number) => void
  /** Wrapped submit that intercepts untagged-tax case */
  gstAwareSubmit: (targetStatus: 'SAVED' | 'DRAFT') => Promise<void>
}

export function useGstInvoice({
  form,
  isSubmitting,
  doSubmit,
  setLineItems,
}: UseGstInvoiceOptions): GstInvoiceExtensions {
  const { gstEnabled } = useGstGate()
  const [showUntaggedDialog, setShowUntaggedDialog] = useState(false)

  const applyInclusivePricing = useCallback((taxRateBP: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        const { taxableValue } = backCalculateInclusive(item.rate, taxRateBP)
        return { ...item, rate: taxableValue }
      }),
    )
  }, [setLineItems])

  const gstAwareSubmit = useCallback(async (targetStatus: 'SAVED' | 'DRAFT') => {
    if (isSubmitting) return

    if (gstEnabled && targetStatus === 'SAVED' && hasUntaggedTaxLines(form)) {
      setShowUntaggedDialog(true)
      return
    }

    await doSubmit()
  }, [isSubmitting, gstEnabled, form, doSubmit])

  const confirmUntaggedSubmit = useCallback(async () => {
    setShowUntaggedDialog(false)
    await doSubmit()
  }, [doSubmit])

  const dismissUntaggedDialog = useCallback(() => {
    setShowUntaggedDialog(false)
  }, [])

  return {
    gstEnabled,
    showUntaggedDialog,
    confirmUntaggedSubmit,
    dismissUntaggedDialog,
    applyInclusivePricing,
    gstAwareSubmit,
  }
}
