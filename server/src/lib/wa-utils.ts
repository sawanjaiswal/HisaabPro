/**
 * WhatsApp utility helpers — phone validation + wa.me link builder.
 *
 * MB-4: phone validated as digits-only 10–15 chars before building any URL.
 * Returning null on invalid phone prevents crashes at call site.
 */

/** Regex: digits only, 10–15 chars (E.164 without the + prefix) */
const PHONE_RE = /^\d{10,15}$/

/**
 * Build a wa.me deep-link.
 * Returns null if phone fails MB-4 validation.
 */
export function buildWaLink(phone: string, message: string): string | null {
  if (!PHONE_RE.test(phone)) return null
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${phone}?text=${encoded}`
}

/**
 * Mask a phone for audit logs.
 * Returns +<cc>XXXXX<last4> where <cc> is the detected country code.
 *
 * F-28: detect country code (1-3 digits before the trailing 10-digit subscriber
 * number) rather than hardcoding +91. A US number like 15551234567 now correctly
 * renders as +1XXXXX4567 in audit logs instead of the misleading +91XXXXX4567.
 *
 * Heuristic: if digits > 10 chars, the first (len-10) digits are the country code.
 * If exactly 10 digits, assume no country code (Indian domestic format).
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const last4 = digits.slice(-4)
  if (digits.length > 10) {
    const ccLen = digits.length - 10
    const cc = digits.slice(0, ccLen)
    return `+${cc}XXXXX${last4}`
  }
  // 10-digit — assume Indian domestic (no country code prefix in input)
  return `+91XXXXX${last4}`
}

/** Returns true if phone is valid per MB-4 rules. */
export function isValidPhone(phone: string): boolean {
  return PHONE_RE.test(phone)
}
