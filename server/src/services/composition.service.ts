/**
 * Composition Scheme Service
 * Handles business-level composition flag logic.
 * Composition taxpayers issue "Bill of Supply" (no tax breakup), pay flat % on turnover.
 * All amounts in PAISE, rates in BASIS POINTS.
 */

import { validationError } from '../lib/errors.js'
import {
  COMPOSITION_RATES,
  COMPOSITION_INVOICE_LABEL,
  COMPOSITION_DISCLAIMER,
} from './composition.constants.js'

export interface CompositionInvoiceInfo {
  isComposite: true
  invoiceLabel: string
  disclaimer: string
  compositionRate: number // basis points
  compositionTax: number  // paise, flat % on grandTotal
}

/**
 * Returns the flat composition rate (basis points) for a given business type.
 * Falls back to 'default' (6%) if business type is unrecognised.
 */
export function getCompositionRate(businessType: string): number {
  const key = businessType.toLowerCase().trim()
  return COMPOSITION_RATES[key] ?? COMPOSITION_RATES['default']
}

/**
 * Calculates the composition tax amount.
 * @param grandTotalPaise  Invoice total in paise (before composition tax)
 * @param rateBasisPoints  Composition rate in basis points
 */
export function calculateCompositionTax(
  grandTotalPaise: number,
  rateBasisPoints: number,
): number {
  return Math.round((grandTotalPaise * rateBasisPoints) / 10000)
}

/**
 * Validates that a composition invoice conforms to GST rules:
 * - No line-level tax amounts (no CGST/SGST/IGST breakdown)
 * - No inter-state supply (composition dealers cannot make inter-state outward supplies)
 * Throws a validationError with a user-friendly message on failure.
 */
export function validateCompositionInvoice(doc: {
  isComposite: boolean
  placeOfSupply: string | null
  businessStateCode: string | null
  totalCgst: number
  totalSgst: number
  totalIgst: number
}): void {
  if (!doc.isComposite) return

  // Composition dealers must not charge tax on the invoice
  if (doc.totalCgst > 0 || doc.totalSgst > 0 || doc.totalIgst > 0) {
    throw validationError(
      'Composition taxpayers cannot charge CGST/SGST/IGST on invoices. Use Bill of Supply.',
    )
  }

  // Composition dealers cannot make inter-state outward supplies
  if (
    doc.businessStateCode &&
    doc.placeOfSupply &&
    doc.businessStateCode.trim() !== doc.placeOfSupply.trim()
  ) {
    throw validationError(
      'Composition taxpayers cannot make inter-state outward supplies.',
    )
  }
}

/**
 * Builds the composition invoice metadata for display/PDF rendering.
 * Returns null if the document is not a composition invoice.
 */
export function getCompositionInvoiceInfo(
  isComposite: boolean,
  businessType: string,
  grandTotalPaise: number,
): CompositionInvoiceInfo | null {
  if (!isComposite) return null

  const compositionRate = getCompositionRate(businessType)
  const compositionTax = calculateCompositionTax(grandTotalPaise, compositionRate)

  return {
    isComposite: true,
    invoiceLabel: COMPOSITION_INVOICE_LABEL,
    disclaimer: COMPOSITION_DISCLAIMER,
    compositionRate,
    compositionTax,
  }
}
