/**
 * Phone PII — single SSOT for masking, hashing, and validating phone numbers.
 *
 * Mask formats:
 *  - maskPhone(p)         → "+91XXXXX1234"    (audit/log canonical, country-code aware)
 *  - maskPhoneForUser(p)  → "****1234"        (user-facing in OTP/SMS strings)
 *  - maskPhonePublic(p)   → "+91 **** 1234"   (public-facing preview pages, spaced)
 *
 * Hash:
 *  - hashPhone(p) → HMAC-SHA256(PHONE_HASH_SALT, digits) → 32-char hex prefix.
 *    Used to correlate log lines without ever logging plaintext digits.
 *    PHONE_HASH_SALT must be set in production (logger will fall back to a
 *    process-instance random salt if unset, which means cross-restart correlation
 *    is lost but no PII leaks).
 */

import crypto from 'node:crypto'

const PHONE_RE = /^\d{10,15}$/

let hashSalt: string | undefined
function getHashSalt(): string {
  if (hashSalt) return hashSalt
  hashSalt = process.env.PHONE_HASH_SALT
  if (!hashSalt) {
    // Fail-open: random per-process so we never crash boot, but log loses
    // cross-restart correlation. Set PHONE_HASH_SALT in production.
    hashSalt = crypto.randomBytes(32).toString('hex')
  }
  return hashSalt
}

/** True if phone is digits-only 10–15 chars (E.164 without the + prefix). */
export function isValidPhone(phone: string): boolean {
  return PHONE_RE.test(phone)
}

/**
 * Canonical audit-log mask: "+<cc>XXXXX<last4>".
 * - >10 digits: first (len-10) are the country code.
 * - exactly 10: assumed Indian domestic.
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const last4 = digits.slice(-4) || '****'
  if (digits.length > 10) {
    const cc = digits.slice(0, digits.length - 10)
    return `+${cc}XXXXX${last4}`
  }
  return `+91XXXXX${last4}`
}

/** Short user-facing mask used inside OTP/SMS confirmation strings. */
export function maskPhoneForUser(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '****'
  return `****${digits.slice(-4)}`
}

/** Public-facing preview mask with spaces, e.g. invite landing pages. */
export function maskPhonePublic(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return null
  return `+91 **** ${digits.slice(-4)}`
}

/**
 * HMAC-SHA256(salt, digits) → 16-byte hex (32 chars).
 * Stable across calls within a process (and across restarts if PHONE_HASH_SALT
 * is set). Safe to log — cannot be reversed without the salt.
 */
export function hashPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return crypto
    .createHmac('sha256', getHashSalt())
    .update(digits)
    .digest('hex')
    .slice(0, 32)
}
