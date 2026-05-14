/**
 * UPI deep-link builder — frontend mirror
 *
 * Kept in sync with server/src/services/upi-link.service.ts (both ~30 LOC).
 * Returns null on validation failure so the QR card can hide cleanly.
 *
 * Spec: NPCI UPI Linking Specification v1.6
 */

/** VPA regex — matches NPCI VPA specification */
const VPA_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z]{1,64}$/

export interface BuildUpiLinkArgs {
  /** Payee VPA — validated against VPA format */
  payeeVpa: string
  /** Payee display name — URL-encoded in output */
  payeeName: string
  /**
   * Amount in PAISE (integer). Pass 0 or omit to produce a no-amount link.
   * Converted to decimal rupees string ("1200.00") internally.
   * Never uses floating-point division directly — uses toFixed(2) on integer division.
   */
  amountPaise?: number
  /** Transaction note (displayed in payer's UPI app, max 80 chars) */
  transactionNote?: string
  /** Transaction reference (e.g. invoice number) */
  transactionRef?: string
}

/**
 * Validates a UPI VPA string.
 * Returns true if the VPA is structurally valid.
 */
export function isValidVpa(vpa: string): boolean {
  return VPA_RE.test(vpa)
}

/**
 * Builds a `upi://pay` deep-link URI.
 * Returns null if the VPA is invalid.
 * amountPaise = 0 → omits the `am` param (customer pays any amount).
 */
export function buildUpiLink(args: BuildUpiLinkArgs): string | null {
  const { payeeVpa, payeeName, amountPaise = 0, transactionNote, transactionRef } = args

  if (!isValidVpa(payeeVpa)) return null

  const params = new URLSearchParams()
  params.set('pa', payeeVpa)
  params.set('pn', payeeName)

  if (amountPaise > 0) {
    // Convert paise to rupees via string arithmetic — no floating-point accumulation
    const rupees = Math.floor(amountPaise / 100)
    const paise = amountPaise % 100
    const amStr = `${rupees}.${String(paise).padStart(2, '0')}`
    params.set('am', amStr)
  }

  if (transactionNote) {
    params.set('tn', transactionNote.slice(0, 80))
  }

  if (transactionRef) {
    params.set('tr', transactionRef)
  }

  params.set('cu', 'INR')

  return `upi://pay?${params.toString()}`
}
