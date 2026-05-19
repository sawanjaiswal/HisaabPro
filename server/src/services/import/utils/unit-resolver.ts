/**
 * Phase 7 · 7.1B — Unit alias resolver
 *
 * Maps a user-supplied unit string to a canonical HP unit name. Pipeline
 * (SCOPE L344-348):
 *
 *   sanitizeControlChars (M6) → NFKC → trim → strip trailing dot →
 *   collapse internal whitespace → devanagari lookup OR latin
 *   case-fold → alias-map lookup → canonical name
 *
 * Returns `{ unit: 'kg' }` on success or `{ unit: null, issue:
 * 'UNIT_NOT_FOUND' }` so the preview UI can show an inline
 * "Create unit '<text>'" deep-link.
 *
 * Cross-references:
 *   - SCOPE L342-395 (alias map)
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1B.md M6
 */

import type { ProductIssueCode } from '../../../types/import.types.js'
import { UNIT_MAX_LEN } from '../../../constants/import.constants.js'
import { sanitizeControlChars } from '../security/unicode.js'

/**
 * Alias → canonical lowercase name. Devanagari keys are preserved
 * verbatim (no case to fold). `"no"` is DELIBERATELY excluded (SCOPE
 * L380-383) — it collides with the boolean header noise common in
 * malformed Generic CSVs and would produce noisier false-positives
 * than the recovery cost of one inline "Create unit 'no'" click.
 */
const UNIT_ALIASES: Record<string, string> = {
  // Count / pieces
  'pcs': 'pcs',
  'pc': 'pcs',
  'pieces': 'pcs',
  'piece': 'pcs',
  'nos': 'pcs',
  'no.': 'pcs',
  'qty': 'pcs',
  'unit': 'pcs',
  'units': 'pcs',
  'each': 'pcs',
  'ea': 'pcs',
  'नग': 'pcs',
  // Weight — kg
  'kg': 'kg',
  'kgs': 'kg',
  'kilo': 'kg',
  'kilos': 'kg',
  'kilogram': 'kg',
  'kilograms': 'kg',
  'किलो': 'kg',
  'किग्रा': 'kg',
  // Weight — g
  'g': 'g',
  'gm': 'g',
  'gms': 'g',
  'gram': 'g',
  'grams': 'g',
  'ग्राम': 'g',
  // Volume — l
  'l': 'l',
  'lt': 'l',
  'ltr': 'l',
  'ltrs': 'l',
  'litre': 'l',
  'litres': 'l',
  'liter': 'l',
  'liters': 'l',
  'लीटर': 'l',
  // Volume — ml
  'ml': 'ml',
  'mls': 'ml',
  'millilitre': 'ml',
  'milliliter': 'ml',
  'मिली': 'ml',
  // Length — m
  'm': 'm',
  'mtr': 'm',
  'mtrs': 'm',
  'metre': 'm',
  'meter': 'm',
  'metres': 'm',
  'meters': 'm',
  'मीटर': 'm',
  // Length — cm
  'cm': 'cm',
  'cms': 'cm',
  // Packaging — box / dozen / case
  'box': 'box',
  'boxes': 'box',
  'bx': 'box',
  'dozen': 'dozen',
  'dz': 'dozen',
  'doz.': 'dozen',
  'case': 'case',
  'ctn': 'carton',
  'carton': 'carton',
  'cartons': 'carton',
  'pack': 'pack',
  'packs': 'pack',
  'pkt': 'packet',
  'packet': 'packet',
  'packets': 'packet',
}

export interface UnitResolveResult {
  unit: string | null
  /** Preserved on UNIT_NOT_FOUND so FE can show "Create unit '<text>'". */
  unitSourceText?: string
  issue?: ProductIssueCode
}

export function resolveUnit(raw: string | undefined | null): UnitResolveResult {
  if (raw === undefined || raw === null) {
    return { unit: null, issue: 'UNIT_INVALID' }
  }
  // M6 sanitiser handles NFKC + bidi strip + control strip + trim + cap.
  const cleaned = sanitizeControlChars(String(raw), { maxLen: UNIT_MAX_LEN })
  if (cleaned === '') return { unit: null, issue: 'UNIT_INVALID' }

  const collapsed = cleaned.replace(/\.$/, '').replace(/\s+/g, ' ').trim()
  // Devanagari first (no case to fold; sanitizeControlChars already
  // NFKC-normalised). Then latin lower-case lookup.
  const direct = UNIT_ALIASES[collapsed]
  const lowered = collapsed.toLowerCase()
  const canonical = direct ?? UNIT_ALIASES[lowered]
  if (!canonical) {
    return { unit: null, unitSourceText: collapsed, issue: 'UNIT_NOT_FOUND' }
  }
  return { unit: canonical }
}
