/** Batch Tracking — Pure utility functions
 *
 * No hooks, no side effects. All functions: input -> output.
 * All monetary params/return values in PAISE unless noted.
 */

import { EXPIRY_WARNING_DAYS, BATCH_NUMBER_MAX, BATCH_NOTES_MAX } from './batch.constants'
import type { ExpiryStatus, Batch } from './batch.types'

// ─── Price conversion ────────────────────────────────────────────────────────

/** Convert paise integer to rupees float (for form pre-population) */
export function paiseToRupees(paise: number): number {
  return paise / 100
}

/** Convert rupees float to paise integer (for storage). Math.round prevents drift. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

// ─── Expiry status ───────────────────────────────────────────────────────────

/** Days until a given expiry date (negative = already expired) */
export function daysUntilExpiry(expiryDate: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

/** Classify expiry status based on EXPIRY_WARNING_DAYS threshold */
export function getExpiryStatus(expiryDate: string | null): ExpiryStatus {
  if (!expiryDate) return 'none'
  const days = daysUntilExpiry(expiryDate)
  if (days < 0) return 'expired'
  if (days <= EXPIRY_WARNING_DAYS) return 'expiring'
  return 'fresh'
}

/**
 * Format expiry date for display: "25 Mar 2026" or "No expiry".
 * Different from lib/format.ts formatDate() which uses DD/MM/YYYY.
 * This batch-specific format uses "day month-short year" for readable expiry labels.
 */
export function formatExpiryDate(date: string | null): string {
  if (!date) return 'No expiry'
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Batch form types + helpers ─────────────────────────────────────────────

export interface BatchFormState {
  batchNumber: string
  manufacturingDate: string
  expiryDate: string
  costPrice: string  // rupees string for input
  salePrice: string  // rupees string for input
  currentStock: string
  notes: string
}

export interface BatchFormErrors {
  batchNumber?: string
  costPrice?: string
  salePrice?: string
  currentStock?: string
  notes?: string
}

export const EMPTY_BATCH_FORM: BatchFormState = {
  batchNumber: '',
  manufacturingDate: '',
  expiryDate: '',
  costPrice: '',
  salePrice: '',
  currentStock: '',
  notes: '',
}

/** Convert a Batch from API to form field values */
export function batchToForm(batch: Batch): BatchFormState {
  return {
    batchNumber: batch.batchNumber,
    manufacturingDate: batch.manufacturingDate?.split('T')[0] ?? '',
    expiryDate: batch.expiryDate?.split('T')[0] ?? '',
    costPrice: batch.costPrice !== null ? (batch.costPrice / 100).toString() : '',
    salePrice: batch.salePrice !== null ? (batch.salePrice / 100).toString() : '',
    currentStock: batch.currentStock.toString(),
    notes: batch.notes ?? '',
  }
}

/** Validate batch form fields. Returns errors object (empty = valid). */
export function validateBatchForm(form: BatchFormState): BatchFormErrors {
  const errors: BatchFormErrors = {}

  if (!form.batchNumber.trim()) {
    errors.batchNumber = 'Batch number is required'
  } else if (form.batchNumber.length > BATCH_NUMBER_MAX) {
    errors.batchNumber = `Max ${BATCH_NUMBER_MAX} characters`
  }

  if (form.costPrice && (isNaN(Number(form.costPrice)) || Number(form.costPrice) < 0)) {
    errors.costPrice = 'Enter a valid price'
  }
  if (form.salePrice && (isNaN(Number(form.salePrice)) || Number(form.salePrice) < 0)) {
    errors.salePrice = 'Enter a valid price'
  }
  if (form.currentStock && (isNaN(Number(form.currentStock)) || Number(form.currentStock) < 0)) {
    errors.currentStock = 'Enter a valid quantity'
  } else if (form.currentStock && !Number.isInteger(Number(form.currentStock))) {
    errors.currentStock = 'Stock must be a whole number'
  }
  if (form.notes.length > BATCH_NOTES_MAX) {
    errors.notes = `Max ${BATCH_NOTES_MAX} characters`
  }

  return errors
}

/** Build API payload from form state */
export function buildBatchPayload(form: BatchFormState): Record<string, unknown> {
  const body: Record<string, unknown> = {
    batchNumber: form.batchNumber.trim(),
  }

  if (form.manufacturingDate) body.manufacturingDate = form.manufacturingDate
  if (form.expiryDate) body.expiryDate = form.expiryDate
  if (form.costPrice !== '') body.costPrice = rupeesToPaise(Number(form.costPrice))
  if (form.salePrice !== '') body.salePrice = rupeesToPaise(Number(form.salePrice))
  if (form.notes.trim()) body.notes = form.notes.trim()

  return body
}
