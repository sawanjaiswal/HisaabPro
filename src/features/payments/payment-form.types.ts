/** Payment Tracking — Form data types
 *
 * Shapes used by the payment creation / edit form.
 * All monetary amounts in PAISE (integer).
 */

import type {
  PaymentType,
  PaymentMode,
  PaymentDiscountType,
} from './payment-enums.types'

// ─── Form Data ────────────────────────────────────────────────────────────────

/** One row in the "Link to Invoices" section of the payment form */
export interface PaymentFormAllocation {
  invoiceId: string
  invoiceNumber: string
  /** How much is still owed on this invoice, in PAISE */
  invoiceDue: number
  /** How much to allocate from this payment, in PAISE */
  amount: number
  /** Whether this invoice row is checked/selected */
  selected: boolean
}

/** Discount section of the payment form */
export interface PaymentFormDiscount {
  type: PaymentDiscountType
  /** 0-100 for PERCENTAGE, paise for FIXED */
  value: number
  /** Calculated amount in PAISE — derived by the hook, not user-entered */
  calculatedAmount: number
  reason: string
}

/** Full shape of the payment creation / edit form */
export interface PaymentFormData {
  type: PaymentType
  partyId: string
  /** Total amount being recorded, in PAISE */
  amount: number
  /** ISO date string "YYYY-MM-DD" */
  date: string
  mode: PaymentMode
  referenceNumber: string
  notes: string
  allocations: PaymentFormAllocation[]
  discount: PaymentFormDiscount | null
}
