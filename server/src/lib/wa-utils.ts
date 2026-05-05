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
 * +91XXXXX1234  (always shows last 4 digits; prefix fixed to +91)
 *
 * Input may be raw digits (10-digit Indian number) or include country code.
 * We always show +91XXXXX<last4>.
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const last4 = digits.slice(-4)
  return `+91XXXXX${last4}`
}

/** Returns true if phone is valid per MB-4 rules. */
export function isValidPhone(phone: string): boolean {
  return PHONE_RE.test(phone)
}
