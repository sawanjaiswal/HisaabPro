/** Invoice Form — Pure Utility Functions
 *
 * Pure functions for form initialization, validation, and payload normalization.
 * No React, no hooks, no side effects. Extracted from useInvoiceForm.ts.
 */

import { toLocalISODate } from '@/lib/format'
import { discountToWire } from './invoice-discount-units'
import type {
  DocumentType,
  DocumentFormData,
  DocumentWirePayload,
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
    customFieldValues: {},
    // Epic B PR2 — price-list override (null = use party's default)
    priceListId: null,
    // Gold-standard payment-at-creation — starts empty (credit sale by default).
    payment: { amountReceived: 0, mode: 'CASH', referenceNumber: '' },
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
): DocumentWirePayload {
  // Drop the three client-only fields the `.strict()` server schema rejects.
  // `supplyType` is server-derived; `payment` is attached by the create call
  // site (never on update); `vehicleNumber` is folded into transportDetails
  // below (the only shape the server persists it from).
  const { supplyType: _supplyType, vehicleNumber, payment: _payment, ...rest } = form
  const trimmedVehicle = vehicleNumber?.trim()
  return {
    ...rest,
    status: targetStatus,
    // Percentages are basis points on the wire — see invoice-discount-units.ts.
    lineItems: form.lineItems.map((item) => ({
      ...item,
      discountValue: discountToWire(item.discountType, item.discountValue),
    })),
    additionalCharges: form.additionalCharges.map((charge) => ({
      ...charge,
      value: discountToWire(charge.type, charge.value),
    })),
    // Normalise empty strings to undefined so the server omits them
    notes: form.notes?.trim() || undefined,
    termsAndConditions: form.termsAndConditions?.trim() || undefined,
    customFieldValues: serializeCustomFieldValues(form.customFieldValues),
    // Fold the top-level vehicle number into transportDetails — the server
    // reads `transportDetails.vehicleNumber`, so a top-level key would both be
    // rejected by `.strict()` and silently dropped.
    transportDetails: trimmedVehicle
      ? {
          vehicleNumber: trimmedVehicle,
          driverName: form.transportDetails?.driverName ?? null,
          transportNotes: form.transportDetails?.transportNotes ?? null,
        }
      : form.transportDetails,
  }
}

/** Form holds values as `{ [fieldDefId]: value }`; server expects an array. */
function serializeCustomFieldValues(
  values: DocumentFormData['customFieldValues'],
): Array<{ fieldDefId: string; valueJson: unknown }> | undefined {
  if (!values || Array.isArray(values)) return Array.isArray(values) && values.length > 0 ? values : undefined
  const entries = Object.entries(values).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (entries.length === 0) return undefined
  return entries.map(([fieldDefId, valueJson]) => ({ fieldDefId, valueJson }))
}
