/** Payment Tracking — Validation utility functions
 *
 * No hooks, no side effects. All functions: input -> output.
 * All monetary params/return values in PAISE (integer) unless noted.
 */

import type {
  PaymentFormData,
} from './payment.types'
import {
  MAX_PAYMENT_AMOUNT,
  MIN_PAYMENT_AMOUNT,
  MAX_NOTES_LENGTH,
  MAX_REFERENCE_LENGTH,
  MAX_DISCOUNT_REASON_LENGTH,
  MAX_ALLOCATIONS_PER_PAYMENT,
} from './payment.constants'

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate a payment amount in paise.
 * Returns an error message string if invalid, null if valid.
 *
 * validatePaymentAmount(0)           -> "Amount must be greater than zero"
 * validatePaymentAmount(100)         -> null
 * validatePaymentAmount(99999999999) -> "Amount cannot exceed ₹99,99,99,999"
 * validatePaymentAmount(99.5)        -> "Amount must be a whole number (paise)"
 */
export function validatePaymentAmount(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Amount must be greater than zero'
  }
  if (!Number.isInteger(amount)) {
    return 'Amount must be a whole number (paise)'
  }
  if (amount < MIN_PAYMENT_AMOUNT) {
    return `Amount must be at least ${MIN_PAYMENT_AMOUNT} paise`
  }
  if (amount > MAX_PAYMENT_AMOUNT) {
    return 'Amount cannot exceed \u20b999,99,99,999'
  }
  return null
}

/**
 * Validate all fields in a PaymentFormData object.
 * Returns a Record<fieldName, errorMessage> — empty object means no errors.
 *
 * Validates: partyId, amount, date, mode, referenceNumber, notes,
 *            allocations (count + individual amounts), discount.
 */
export function validatePaymentForm(
  form: PaymentFormData
): Record<string, string> {
  const errors: Record<string, string> = {}

  // Party
  if (!form.partyId || form.partyId.trim() === '') {
    errors.partyId = 'Please select a party'
  }

  // Amount
  const amountError = validatePaymentAmount(form.amount)
  if (amountError !== null) {
    errors.amount = amountError
  }

  // Date
  if (!form.date || form.date.trim() === '') {
    errors.date = 'Payment date is required'
  }

  // Mode
  if (!form.mode || form.mode.trim() === '') {
    errors.mode = 'Please select a payment mode'
  }

  // Reference number
  if (
    form.referenceNumber !== undefined &&
    form.referenceNumber !== null &&
    form.referenceNumber.length > MAX_REFERENCE_LENGTH
  ) {
    errors.referenceNumber = `Reference cannot exceed ${MAX_REFERENCE_LENGTH} characters`
  }

  // Notes
  if (
    form.notes !== undefined &&
    form.notes !== null &&
    form.notes.length > MAX_NOTES_LENGTH
  ) {
    errors.notes = `Notes cannot exceed ${MAX_NOTES_LENGTH} characters`
  }

  // Allocations
  if (form.allocations !== undefined && form.allocations !== null) {
    if (form.allocations.length > MAX_ALLOCATIONS_PER_PAYMENT) {
      errors.allocations = `Cannot link more than ${MAX_ALLOCATIONS_PER_PAYMENT} invoices per payment`
    } else {
      const totalAllocated = form.allocations.reduce(
        (sum, a) => sum + a.amount,
        0
      )
      if (totalAllocated > form.amount) {
        errors.allocations = 'Total allocated amount exceeds payment amount'
      }
      const invalidAlloc = form.allocations.find(
        (a) => !Number.isInteger(a.amount) || a.amount <= 0
      )
      if (invalidAlloc !== undefined) {
        errors.allocations = 'Each allocation must be a positive whole-number amount (paise)'
      }
    }
  }

  // Discount
  if (form.discount !== undefined && form.discount !== null) {
    const { type, value, reason } = form.discount

    if (type === 'PERCENTAGE') {
      if (value <= 0 || value > 100) {
        errors['discount.value'] = 'Discount percentage must be between 0 and 100'
      }
    } else if (type === 'FIXED') {
      if (!Number.isInteger(value) || value <= 0) {
        errors['discount.value'] = 'Discount amount must be a positive whole number (paise)'
      }
      if (value > form.amount) {
        errors['discount.value'] = 'Discount cannot exceed payment amount'
      }
    }

    if (
      reason !== undefined &&
      reason !== null &&
      reason.length > MAX_DISCOUNT_REASON_LENGTH
    ) {
      errors['discount.reason'] = `Reason cannot exceed ${MAX_DISCOUNT_REASON_LENGTH} characters`
    }
  }

  return errors
}
