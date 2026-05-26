/**
 * WhatsApp utility helpers — wa.me link builder.
 *
 * Phone validation + masking live in `./phone-pii.ts` (cross-cutting concern).
 * This file re-exports them so existing imports keep working.
 */

import { isValidPhone, maskPhone } from './phone-pii.js'

/**
 * Build a wa.me deep-link.
 * Returns null if phone fails E.164-without-+ validation.
 */
export function buildWaLink(phone: string, message: string): string | null {
  if (!isValidPhone(phone)) return null
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${phone}?text=${encoded}`
}

export { isValidPhone, maskPhone }
