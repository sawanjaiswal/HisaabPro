/**
 * UPI Intent URL Utilities — pure functions, no side-effects.
 * Builds UPI deep-link URLs for mandate/payment flows on Android.
 *
 * Android: window.location.href = upiIntentUrl triggers UPI app selection.
 * iOS: Razorpay hosted page fallback (no deep-link this round).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpiPaymentParams {
  vpa: string        // UPI VPA (e.g. 9999999999@ybl)
  payerName: string  // Merchant / business name
  amount: number     // Int paise — will be converted to rupees
  note: string       // Transaction note
  transactionRef: string  // Unique ref (mandate ID or order ID)
  currency?: string  // Default 'INR'
}

export interface UpiMandateParams {
  vpa: string
  payerName: string
  maxAmountPaise: number  // Int paise
  frequency: 'MONTHLY' | 'YEARLY'
  note: string
  merchantVpa: string    // From RAZORPAY_MERCHANT_VPA env
  merchantName: string   // From RAZORPAY_MERCHANT_NAME env
  transactionRef: string // Mandate ID or order ID
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert paise (Int) to rupees string with 2 decimal places. */
function paiseToRupees(paise: number): string {
  return (paise / 100).toFixed(2)
}

/** Mask VPA for logging — show only last 4 chars before @. */
export function maskVpa(vpa: string): string {
  const atIdx = vpa.indexOf('@')
  if (atIdx < 0) return '***@unknown'
  const local = vpa.slice(0, atIdx)
  const domain = vpa.slice(atIdx)
  if (local.length <= 4) return `***${domain}`
  return `***${local.slice(-4)}${domain}`
}

// ─── UPI payment deep-link ────────────────────────────────────────────────────

/**
 * Build a UPI payment deep-link URL.
 * Format: upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=<currency>&tn=<note>&tr=<ref>
 */
export function buildUpiPayDeepLink(params: UpiPaymentParams): string {
  const amountRupees = paiseToRupees(params.amount)
  const url = new URL('upi://pay')
  url.searchParams.set('pa', params.vpa)
  url.searchParams.set('pn', params.payerName)
  url.searchParams.set('am', amountRupees)
  url.searchParams.set('cu', params.currency ?? 'INR')
  url.searchParams.set('tn', params.note)
  url.searchParams.set('tr', params.transactionRef)
  return url.toString()
}

/**
 * Build a UPI mandate deep-link URL.
 * Format: upi://mandate?pa=<merchant>&pn=<merchant>&mc=<maxAmt>&cu=INR&tn=<note>&am=<maxAmt>
 * Note: UPI mandate spec varies by app; this is the common subset.
 */
export function buildUpiMandateDeepLink(params: UpiMandateParams): string {
  const maxRupees = paiseToRupees(params.maxAmountPaise)
  const url = new URL('upi://mandate')
  url.searchParams.set('pa', params.merchantVpa)
  url.searchParams.set('pn', params.merchantName)
  url.searchParams.set('mc', maxRupees)  // max charge per period
  url.searchParams.set('am', maxRupees)
  url.searchParams.set('cu', 'INR')
  url.searchParams.set('tn', params.note)
  url.searchParams.set('tr', params.transactionRef ?? '')
  url.searchParams.set('mode', 'recurring')
  url.searchParams.set('purpose', 'subscription')
  return url.toString()
}
