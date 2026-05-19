/**
 * Phase 7 Slice 7.1B FE.B1 — BigInt-safe paise formatter for product
 * preview rows.
 *
 * Server emits `salePrice|purchasePrice|mrp` as JSON strings (BigInt has
 * no JSON representation — see SECURITY_AUDIT M5). The regex on the BE
 * caps prices at `^\d{1,12}(\.\d{0,2})?$`, which converts to at most
 * 12 + 2 = 14 paise digits — well inside `Number.MAX_SAFE_INTEGER`
 * (16 digits). We still assert before the cast: a hostile or buggy BE
 * could ship a larger number, and `Number(b)` would silently lose
 * precision.
 *
 * Returns the locale-formatted Indian rupee string. On overflow we fall
 * back to the raw paise/100 string so the user always sees a value
 * rather than `NaN` or `Infinity`.
 */

import { formatPaise } from '@/lib/format'

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER)

/**
 * @param paiseStr — server-emitted decimal-integer string ("0" allowed,
 *                   negatives rejected, empty returns "—").
 * @returns Display string. Never throws.
 */
export function formatCurrencyFromString(paiseStr: string | null | undefined): string {
  if (paiseStr === null || paiseStr === undefined || paiseStr === '') return '—'
  // Reject obvious garbage early — only digit string is acceptable.
  if (!/^\d+$/.test(paiseStr)) return '—'
  let big: bigint
  try {
    big = BigInt(paiseStr)
  } catch {
    return '—'
  }
  if (big > MAX_SAFE) {
    // Fallback: format paise/100 by string slicing so we never coerce
    // a precision-losing Number.
    const s = paiseStr.padStart(3, '0')
    const intPart = s.slice(0, -2) || '0'
    const fracPart = s.slice(-2)
    return `Rs ${intPart}.${fracPart}`
  }
  return formatPaise(Number(big))
}
