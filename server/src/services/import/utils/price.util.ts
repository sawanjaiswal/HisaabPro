/**
 * Phase 7 · 7.1B — Price → paise BigInt
 *
 * Pure string-math conversion of a raw price string into a `bigint`
 * representing whole paise. `parseFloat` is FORBIDDEN here (loses
 * precision past the 7th decimal digit on certain inputs and folds
 * "1,000.00" into NaN). Pipeline:
 *
 *   1. trim → strip commas
 *   2. if >2 fractional digits → half-away-from-zero round → emit
 *      PRICE_PRECISION_LOST issue (still convert)
 *   3. regex test against `^\d{1,12}(\.\d{0,2})?$` → PRICE_INVALID
 *      otherwise
 *   4. split int/frac, zero-pad frac to 2 chars, concat as decimal
 *      string, BigInt() → paise
 *   5. compare against PRICE_MAX_PAISE for the regex-evading edge
 *      (≤MAX_SAFE_INTEGER paise)
 *
 * SCOPE L297-326. SECURITY M5.
 */

import type { ProductIssueCode } from '../../../types/import.types.js'
import {
  PRICE_COMMA_STRIP,
  PRICE_MAX_PAISE,
  PRICE_PRECISION_LOST_REGEX,
  PRICE_PRECISION_REGEX,
} from '../../../constants/import.constants.js'

export interface PriceParseResult {
  value: bigint | null
  issue?: ProductIssueCode
}

/**
 * Half-away-from-zero rounding of a fractional digit string to 2dp.
 * Pure string math — no `Math.round`, no Number(). Walks digit at index
 * 2 (the third frac digit) and propagates carry leftward.
 */
export function roundFracStringTo2dp(frac: string): string {
  if (frac.length <= 2) return (frac + '00').slice(0, 2)
  const head = frac.slice(0, 2)
  const next = frac.charCodeAt(2) - 48 // ASCII '0' = 48
  if (next < 5) return head
  // round up — carry through head digits
  const arr = head.split('').map((c) => c.charCodeAt(0) - 48)
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    arr[i] = (arr[i] ?? 0) + 1
    if ((arr[i] ?? 0) < 10) {
      return arr.map((d) => String(d)).join('')
    }
    arr[i] = 0
  }
  // carry propagated past the head → frac becomes "00" and caller's
  // integer side gets +1. Express the carry by signaling via "100",
  // which the caller detects by length>2.
  return '100'
}

/**
 * Parse raw price string → paise BigInt with structured issue code.
 * Returns `{ value: null, issue }` on rejection; `{ value, issue? }` on
 * success (issue present only for PRICE_PRECISION_LOST warnings).
 */
export function parsePaiseBigInt(raw: string | undefined | null): PriceParseResult {
  if (raw === undefined || raw === null) return { value: null, issue: 'PRICE_INVALID' }
  const trimmed = String(raw).trim().replace(PRICE_COMMA_STRIP, '')
  if (trimmed === '') return { value: null, issue: 'PRICE_INVALID' }

  let normalized = trimmed
  let warning: ProductIssueCode | undefined
  let intCarry = 0
  if (PRICE_PRECISION_LOST_REGEX.test(trimmed)) {
    const [intPart, fracPart] = trimmed.split('.') as [string, string]
    const rounded = roundFracStringTo2dp(fracPart)
    if (rounded.length > 2) {
      // carry overflow — bump int part by 1
      intCarry = 1
      normalized = `${intPart}.00`
    } else {
      normalized = `${intPart}.${rounded}`
    }
    warning = 'PRICE_PRECISION_LOST'
  }

  if (!PRICE_PRECISION_REGEX.test(normalized)) {
    // Distinguish "looks like a number but too big" from "garbage".
    if (/^\d+(\.\d+)?$/.test(normalized)) {
      return { value: null, issue: 'PRICE_OUT_OF_RANGE' }
    }
    return { value: null, issue: 'PRICE_INVALID' }
  }

  const [intStrRaw, fracStrRaw = ''] = normalized.split('.') as [string, string]
  // Apply carry from rounding overflow.
  const intStr = intCarry === 0
    ? intStrRaw
    : addOneToIntString(intStrRaw)
  if (intStr.length > 12) {
    return { value: null, issue: 'PRICE_OUT_OF_RANGE' }
  }
  const fracPadded = (fracStrRaw + '00').slice(0, 2)
  let paise: bigint
  try {
    paise = BigInt(intStr + fracPadded)
  } catch {
    return { value: null, issue: 'PRICE_INVALID' }
  }
  if (paise > PRICE_MAX_PAISE) {
    return { value: null, issue: 'PRICE_OUT_OF_RANGE' }
  }
  return warning ? { value: paise, issue: warning } : { value: paise }
}

/** Pure string +1 (carries left). Caller has bounded length, so safe. */
function addOneToIntString(s: string): string {
  const arr = s.split('').map((c) => c.charCodeAt(0) - 48)
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    arr[i] = (arr[i] ?? 0) + 1
    if ((arr[i] ?? 0) < 10) return arr.map((d) => String(d)).join('')
    arr[i] = 0
  }
  return '1' + arr.map((d) => String(d)).join('')
}
