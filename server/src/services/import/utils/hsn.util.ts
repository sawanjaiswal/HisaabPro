/**
 * Phase 7 · 7.1B — HSN code validation (M7)
 *
 * HSN/SAC codes are 4, 6, or 8 numeric digits. Anything else surfaces
 * an HSN_INVALID warning AND drops the value (per SCOPE L113) — the
 * Product table prefers a missing HSN over a garbled one.
 *
 * Null / empty input is NOT an error — HSN is optional.
 *
 * Cross-references:
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1B.md M7
 */

import type { ProductIssueCode } from '../../../types/import.types.js'
import {
  HSN_CHARSET_REGEX,
  HSN_VALID_LENGTHS,
} from '../../../constants/import.constants.js'
import { sanitizeControlChars } from '../security/unicode.js'

export interface HsnResult {
  hsn: string | null
  issue?: ProductIssueCode
}

export function validateHsn(raw: string | undefined | null): HsnResult {
  if (raw === undefined || raw === null) return { hsn: null }
  const cleaned = sanitizeControlChars(String(raw), { maxLen: 16 })
  if (cleaned === '') return { hsn: null }
  if (!HSN_CHARSET_REGEX.test(cleaned)) {
    return { hsn: null, issue: 'HSN_INVALID' }
  }
  if (!HSN_VALID_LENGTHS.has(cleaned.length)) {
    return { hsn: null, issue: 'HSN_INVALID' }
  }
  return { hsn: cleaned }
}
