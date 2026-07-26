/**
 * The one definition of what a Party's phone number looks like in storage.
 *
 * `Party.phone` is a bare 10-digit Indian mobile number — that is what the
 * create/update schemas accept, what dedup queries compare against, and what
 * every screen renders. Any other producer of a party (import, storefront
 * lead, referral) has to arrive at the same shape, or its rows silently stop
 * matching the ones the app itself wrote: an import that stored `+91XXXXXXXXXX`
 * created a duplicate of every existing customer and produced parties whose
 * phone the update endpoint then rejected.
 */

/** Storage shape of `Party.phone` — 10 digits, Indian mobile series. */
export const PARTY_PHONE_REGEX = /^[6-9]\d{9}$/

/** Country code assumed when a number arrives without one. */
const INDIA_CC = '91'

/**
 * Convert any human-typed phone to the stored shape, or `null` if it cannot
 * be one. Accepts spaces, dashes, brackets, a leading `+`, and an explicit
 * `91` / `0` prefix — all of which appear in real exported files.
 */
export function toPartyPhone(raw: string | undefined | null): string | null {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (digits.length > 10 && digits.startsWith(INDIA_CC)) {
    digits = digits.slice(INDIA_CC.length)
  }
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return PARTY_PHONE_REGEX.test(digits) ? digits : null
}
