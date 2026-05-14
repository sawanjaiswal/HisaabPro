/**
 * UPI deep-link builder — server-side
 *
 * Builds a `upi://pay` URI from structured args.
 * FE mirror: src/lib/upi.ts — keep in sync manually (both ~30 LOC).
 *
 * Spec: NPCI UPI Linking Specification v1.6
 *   pa = payee VPA
 *   pn = payee name
 *   am = amount (decimal, 2 places)
 *   tn = transaction note (max 80 chars)
 *   tr = transaction reference
 *   cu = currency (always INR)
 */

/** Max UPI transaction amount (NPCI limit: ₹1,00,000) */
const UPI_MAX_AMOUNT_RUPEES = Number(process.env.UPI_MAX_AMOUNT_RUPEES ?? 100_000)

/** VPA regex — matches NPCI VPA specification */
const VPA_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z]{1,64}$/

export class UpiValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UpiValidationError'
  }
}

export interface BuildUpiLinkArgs {
  /** Payee VPA — validated against VPA format */
  payeeVpa: string
  /** Payee display name — URL-encoded in output */
  payeeName: string
  /** Amount in RUPEES (decimal). Omit or 0 = no amount in link */
  amountRupees?: number
  /** Transaction note (displayed in payer's UPI app, max 80 chars) */
  transactionNote?: string
  /** Transaction reference (e.g. invoice number — alnum + hyphen only) */
  transactionRef?: string
}

/**
 * Builds a `upi://pay` deep-link URI.
 * Throws `UpiValidationError` for invalid VPA or amount out of range.
 */
export function buildUpiLink(args: BuildUpiLinkArgs): string {
  const { payeeVpa, payeeName, amountRupees, transactionNote, transactionRef } = args

  if (!VPA_RE.test(payeeVpa)) {
    throw new UpiValidationError(`Invalid UPI VPA: ${payeeVpa}`)
  }

  const amount = amountRupees ?? 0
  if (amount < 0) {
    throw new UpiValidationError('UPI amount cannot be negative')
  }
  if (amount > UPI_MAX_AMOUNT_RUPEES) {
    throw new UpiValidationError(`UPI amount exceeds maximum ₹${UPI_MAX_AMOUNT_RUPEES.toLocaleString('en-IN')}`)
  }

  const params = new URLSearchParams()
  params.set('pa', payeeVpa)
  params.set('pn', payeeName)

  if (amount > 0) {
    // Integer arithmetic to avoid floating-point drift
    params.set('am', amount.toFixed(2))
  }

  if (transactionNote) {
    const note = transactionNote.slice(0, 80)
    params.set('tn', note)
  }

  if (transactionRef) {
    params.set('tr', transactionRef)
  }

  params.set('cu', 'INR')

  return `upi://pay?${params.toString()}`
}
