/** Invoice Form — Pure Utility Functions
 *
 * Pure functions for form initialization, validation, and payload normalization.
 * No React, no hooks, no side effects. Extracted from useInvoiceForm.ts.
 */

import { toLocalISODate } from '@/lib/format'
import type {
  DocumentType,
  DocumentFormData,
} from './invoice.types'

// ─── Initial form state builder ─────────────────────────────────────────────

export function buildInitialForm(type: DocumentType): DocumentFormData {
  return {
    type,
    status: 'DRAFT',
    partyId: '',
    documentDate: toLocalISODate(new Date()),
    paymentTerms: 'COD',
    dueDate: undefined,
    shippingAddressId: null,
    notes: '',
    termsAndConditions: '',
    vehicleNumber: '',
    includeSignature: false,
    lineItems: [],
    additionalCharges: [],
    transportDetails: null,
    // GST Phase 2 defaults
    placeOfSupply: undefined,
    taxPricingMode: 'EXCLUSIVE',
    isReverseCharge: false,
    supplyType: 'B2C_SMALL',
  }
}

// ─── Form validation (pure — returns errors record) ─────────────────────────

export function validateInvoiceForm(
  form: DocumentFormData,
  hasStockBlocks: boolean,
  gstEnabled = false,
): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!form.partyId) {
    errors.partyId = 'Customer / supplier is required'
  }

  if (!form.documentDate) {
    errors.documentDate = 'Invoice date is required'
  }

  if (form.lineItems.length === 0) {
    errors.lineItems = 'At least one item is required'
  }

  // GST Phase 2 — place of supply required when GST enabled
  if (gstEnabled && !form.placeOfSupply) {
    errors.placeOfSupply = 'Place of supply is required when GST is enabled'
  }

  form.lineItems.forEach((item, index) => {
    if (!item.productId) {
      errors[`lineItems.${index}.productId`] = 'Product is required'
    }
    if (item.quantity <= 0) {
      errors[`lineItems.${index}.quantity`] = 'Quantity must be greater than 0'
    }
    if (item.rate < 0) {
      errors[`lineItems.${index}.rate`] = 'Rate cannot be negative'
    }
  })

  // Block if any stock items are hard-blocked
  if (hasStockBlocks) {
    errors.stock = 'Some items have insufficient stock'
  }

  return errors
}

/** Returns true if any line item has taxCategoryId = null (untagged) */
export function hasUntaggedTaxLines(form: DocumentFormData): boolean {
  return form.lineItems.some((item) => item.taxCategoryId === null)
}

// ─── Payload normalization (pure — returns cleaned form data) ───────────────

export function normalizeFormPayload(
  form: DocumentFormData,
  targetStatus: 'SAVED' | 'DRAFT',
): DocumentFormData {
  return {
    ...form,
    status: targetStatus,
    // Normalise empty strings to undefined so the server omits them
    notes: form.notes?.trim() || undefined,
    termsAndConditions: form.termsAndConditions?.trim() || undefined,
  }
}
