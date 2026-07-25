/** useInvoiceGstSummary — live CGST/SGST/IGST breakdown for the create screen.
 *
 * Reads the same caches the rest of the flow already populates (GST settings +
 * tax categories) and reuses the canonical `calculateDocumentTax` engine — the
 * one that mirrors the server's tax-calc.ts. This hook only *assembles* the
 * per-line tax inputs from the form; it computes nothing itself, so the summary
 * shown here can't drift from what the server will persist.
 */

import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { GST_SETTINGS_QUERY_KEY } from '@/features/gst/useGstSettings'
import type { GstSettings } from '@/features/gst/gst.types'
import type { TaxCategory } from '@/lib/types/tax.types'
import { calculateLineTotal } from './invoice-calc.utils'
import {
  calculateDocumentTax,
  isInterState,
  backCalculateInclusive,
} from '@/features/tax/tax-calc.utils'
import type { TaxLineInput } from '@/features/tax/tax-calc.utils'
import type { DocumentTaxSummary } from '@/features/tax/tax.types'
import type { LineItemFormData } from './invoice-api.types'
import type { TaxPricingMode } from '@/features/gst/gst.types'

export interface InvoiceGstSummary {
  summary: DocumentTaxSummary
  interState: boolean
}

/** Returns the live GST breakdown, or null when there is nothing to show
 *  (no taxed lines, or the business is on the composition scheme where lines
 *  carry no GST). Callers mount the summary card only on a non-null result. */
export function useInvoiceGstSummary(
  lineItems: LineItemFormData[],
  placeOfSupply: string | undefined,
  taxPricingMode: TaxPricingMode,
): InvoiceGstSummary | null {
  const qc = useQueryClient()
  const gst = qc.getQueryData<GstSettings>(GST_SETTINGS_QUERY_KEY)
  const categories = qc.getQueryData<TaxCategory[]>(queryKeys.tax.categories()) ?? []

  return useMemo(() => {
    if (!gst?.gstEnabled || gst.compositionScheme) return null

    const interState = isInterState(gst.stateCode, placeOfSupply ?? null)
    const inputs: TaxLineInput[] = []

    for (const line of lineItems) {
      if (line.isFreeItem) continue // BOGO freebies contribute no taxable value
      const cat = categories.find((c) => c.id === line.taxCategoryId)
      const gstRate = cat?.rate ?? 0
      if (gstRate <= 0 && (cat?.cessRate ?? 0) <= 0) continue

      const { lineTotal } = calculateLineTotal(
        line.quantity,
        line.rate,
        line.discountType,
        line.discountValue,
      )
      // INCLUSIVE prices bake tax in — strip it back out to the taxable base
      // before the engine applies the rate, so tax isn't double-counted.
      const taxableValue =
        taxPricingMode === 'INCLUSIVE'
          ? backCalculateInclusive(lineTotal, gstRate).taxableValue
          : lineTotal

      inputs.push({
        lineTotal: taxableValue,
        gstRate,
        cessRate: cat?.cessRate ?? 0,
        cessType: cat?.cessType ?? 'PERCENTAGE',
        quantity: line.quantity,
      })
    }

    if (inputs.length === 0) return null
    const summary = calculateDocumentTax(inputs, interState)
    if (summary.totalTax === 0) return null
    return { summary, interState }
  }, [gst, categories, lineItems, placeOfSupply, taxPricingMode])
}
