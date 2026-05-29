/** Payment voucher — types (#90 receipt voucher, #91 payment voucher)
 *
 * A voucher is the printable acknowledgement of a money movement:
 *   PAYMENT_IN / PAYROLL_IN  → RECEIPT voucher (we acknowledge money received)
 *   PAYMENT_OUT / PAYROLL_OUT → PAYMENT voucher (we acknowledge money paid out)
 */

/** Which voucher template to render. Derived from PaymentType. */
export type VoucherKind = 'RECEIPT' | 'PAYMENT'

/** One invoice allocation line shown on the voucher. Amount in PAISE. */
export interface VoucherAllocationLine {
  invoiceNumber: string
  amount: number
}

/** Fully-resolved, render-ready voucher data (no enums, no nullables for the
 *  renderer to branch on beyond what is explicitly optional). */
export interface VoucherData {
  kind: VoucherKind
  /** Localised title, e.g. "Receipt Voucher" / "रसीद वाउचर" */
  title: string
  businessName: string
  partyName: string
  /** Total amount in PAISE */
  amount: number
  /** Amount rendered in Indian words, e.g. "Rupees One Thousand Only" */
  amountInWords: string
  /** ISO date string "YYYY-MM-DD" */
  date: string
  /** Localised payment mode label, e.g. "UPI", "Cash" */
  modeLabel: string
  referenceNumber: string | null
  notes: string | null
  allocations: VoucherAllocationLine[]
  /** Portion not linked to any invoice, in PAISE (0 when fully allocated) */
  unallocatedAmount: number
}
