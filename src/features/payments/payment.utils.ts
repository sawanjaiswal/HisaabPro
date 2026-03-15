/** Payment Tracking — Pure utility functions
 *
 * No hooks, no side effects. All functions: input → output.
 * All monetary params/return values in PAISE (integer) unless noted.
 *
 * Rule: never use floating-point arithmetic on money directly.
 * Always Math.round() when multiplying paise by a fraction.
 */

import type {
  PaymentFormData,
  PaymentFormAllocation,
  PaymentFormDiscount,
  OutstandingAging,
} from './payment.types'
import {
  MAX_PAYMENT_AMOUNT,
  MIN_PAYMENT_AMOUNT,
  MAX_NOTES_LENGTH,
  MAX_REFERENCE_LENGTH,
  MAX_DISCOUNT_REASON_LENGTH,
  MAX_ALLOCATIONS_PER_PAYMENT,
  PAYMENT_MODE_LABELS,
  REFERENCE_PLACEHOLDERS,
} from './payment.constants'

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate a payment amount in paise.
 * Returns an error message string if invalid, null if valid.
 *
 * validatePaymentAmount(0)           → "Amount must be greater than zero"
 * validatePaymentAmount(100)         → null
 * validatePaymentAmount(99999999999) → "Amount cannot exceed ₹99,99,99,999"
 * validatePaymentAmount(99.5)        → "Amount must be a whole number (paise)"
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

// ─── Discount calculation ──────────────────────────────────────────────────────

/**
 * Calculate the discount amount in paise.
 *
 * PERCENTAGE: discountValue is 0-100 → Math.round(outstanding × value / 100)
 * FIXED:      discountValue is already in paise → returned as-is (capped at outstanding)
 *
 * calculateDiscount('PERCENTAGE', 10, 1000000) → 100000  (10% of ₹10,000)
 * calculateDiscount('FIXED', 50000, 1000000)  → 50000   (₹500 flat)
 * calculateDiscount('FIXED', 2000000, 1000000) → 1000000 (capped at outstanding)
 */
export function calculateDiscount(
  type: 'PERCENTAGE' | 'FIXED',
  value: number,
  outstanding: number
): number {
  if (value <= 0 || outstanding <= 0) return 0

  if (type === 'PERCENTAGE') {
    const pct = Math.min(value, 100)
    return Math.round((outstanding * pct) / 100)
  }

  // FIXED: cannot exceed outstanding
  return Math.min(value, outstanding)
}

// ─── Allocation helpers ────────────────────────────────────────────────────────

/**
 * Auto-allocate a payment amount across invoices using FIFO (oldest first by order).
 * Invoices are expected in the order they should be paid (oldest first).
 * Each invoice's `amount` field in the returned array is how much of the payment
 * is allocated to it — capped at that invoice's `due` (outstanding due amount).
 *
 * Invoices that can't receive any allocation (running total exhausted) get amount = 0.
 *
 * autoAllocateFIFO(15000, [
 *   { invoiceId: 'a', due: 10000, amount: 0 },
 *   { invoiceId: 'b', due: 8000, amount: 0 },
 * ])
 * → [{ invoiceId: 'a', due: 10000, amount: 10000 },
 *    { invoiceId: 'b', due: 8000, amount: 5000 }]
 */
export function autoAllocateFIFO(
  amount: number,
  invoices: PaymentFormAllocation[]
): PaymentFormAllocation[] {
  let remaining = amount

  return invoices.map((invoice) => {
    if (remaining <= 0) {
      return { ...invoice, amount: 0 }
    }
    const allocated = Math.min(remaining, invoice.invoiceDue)
    remaining -= allocated
    return { ...invoice, amount: allocated }
  })
}

/**
 * Calculate the unallocated portion of a payment in paise.
 * Unallocated amount = total payment − sum of all allocation amounts.
 * A positive result means advance balance; this cannot be negative by contract.
 *
 * calculateUnallocatedAmount(15000, [{ amount: 10000 }, { amount: 3000 }]) → 2000
 */
export function calculateUnallocatedAmount(
  totalAmount: number,
  allocations: PaymentFormAllocation[]
): number {
  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0)
  return Math.max(0, totalAmount - totalAllocated)
}

/**
 * Calculate the settlement breakdown for a payment with an optional discount.
 *
 * Returns:
 *   payment       — the cash payment amount (paise)
 *   discount      — the discount amount applied (paise, 0 if no discount)
 *   totalSettled  — payment + discount (paise) — what this clears from outstanding
 *
 * calculateSettlement(900000, { type: 'FIXED', value: 100000, reason: null })
 * → { payment: 900000, discount: 100000, totalSettled: 1000000 }
 *
 * calculateSettlement(1000000, null)
 * → { payment: 1000000, discount: 0, totalSettled: 1000000 }
 */
export function calculateSettlement(
  amount: number,
  discount: PaymentFormDiscount | null
): { payment: number; discount: number; totalSettled: number } {
  const discountAmount =
    discount !== null
      ? calculateDiscount(discount.type, discount.value, amount)
      : 0

  return {
    payment: amount,
    discount: discountAmount,
    totalSettled: amount + discountAmount,
  }
}

// ─── Aging helpers ─────────────────────────────────────────────────────────────

/**
 * Sum all aging buckets to get the total outstanding across all aging periods.
 * All values are in paise.
 *
 * calculateAgingTotal({ current: 5000, days1to30: 3000, days31to60: 2000,
 *                        days61to90: 1000, days90plus: 500 }) → 11500
 */
export function calculateAgingTotal(aging: OutstandingAging): number {
  return (
    aging.current +
    aging.days1to30 +
    aging.days31to60 +
    aging.days61to90 +
    aging.days90plus
  )
}

/**
 * Return each aging bucket as a percentage of the total outstanding.
 * All values are 0-100, rounded to one decimal place.
 * Returns all zeros if total is 0 (avoids division-by-zero).
 *
 * getAgingPercentages({ current: 10000, days1to30: 0, days31to60: 0,
 *                        days61to90: 0, days90plus: 0 })
 * → { current: 100, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 }
 */
export function getAgingPercentages(
  aging: OutstandingAging
): Record<keyof OutstandingAging, number> {
  const total = calculateAgingTotal(aging)

  if (total === 0) {
    return {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      days90plus: 0,
    }
  }

  const pct = (value: number): number =>
    Math.round((value / total) * 1000) / 10  // one decimal place

  return {
    current: pct(aging.current),
    days1to30: pct(aging.days1to30),
    days31to60: pct(aging.days31to60),
    days61to90: pct(aging.days61to90),
    days90plus: pct(aging.days90plus),
  }
}

// ─── Format helpers ───────────────────────────────────────────────────────────

/**
 * Return the display label for a PaymentMode enum value.
 * Falls back to the raw mode string if the mode is not in the label map.
 *
 * formatPaymentMode('UPI')            → "UPI"
 * formatPaymentMode('NEFT_RTGS_IMPS') → "NEFT / RTGS / IMPS"
 * formatPaymentMode('CHEQUE')         → "Cheque"
 */
export function formatPaymentMode(mode: string): string {
  return PAYMENT_MODE_LABELS[mode as keyof typeof PAYMENT_MODE_LABELS] ?? mode
}

/**
 * Return the input placeholder text for the reference number field, based on payment mode.
 * Shown below the reference field to guide the user on what to enter.
 *
 * getReferencePlaceholder('UPI')           → "UPI Transaction ID"
 * getReferencePlaceholder('CHEQUE')        → "Cheque Number"
 * getReferencePlaceholder('BANK_TRANSFER') → "Transaction Reference"
 */
export function getReferencePlaceholder(mode: string): string {
  return (
    REFERENCE_PLACEHOLDERS[mode as keyof typeof REFERENCE_PLACEHOLDERS] ??
    'Reference'
  )
}
