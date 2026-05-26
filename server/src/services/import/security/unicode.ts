/**
 * Phase 7 · 7.1B — M6 Shared unicode sanitiser
 *
 * Strips control + bidi + zero-width codepoints, normalises to NFKC,
 * trims, optionally length-slices. Used by EVERY user-supplied string
 * in the product pipeline: name, sku, hsn, description, unit source
 * text. Centralised so a new attack vector is one fix, not five.
 *
 * Bidi + zero-width set (RTL overrides, LRE/RLE/PDF, LRI/RLI/FSI/PDI,
 * BOM, ZWJ/ZWNJ/ZWSP) — these are how attackers spoof unit aliases or
 * smuggle dot-files past filename sanitisation.
 *
 * Cross-references:
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1B.md M6
 */

// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\x00-\x1F\x7F]/g
// Bidi / formatting / zero-width codepoints (NOT a character class — JS
// regex character classes pre-NFKC can't reliably express these ranges
// inside one bracket without surrogate gotchas, so we alternate).
const BIDI_ZW_RE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g

export interface SanitizeOptions {
  /** Max length AFTER NFKC + trim. Omit for no cap. */
  maxLen?: number
}

/**
 * Pipeline: strip bidi/zero-width → strip control → NFKC normalise →
 * trim → optional slice. The bidi strip MUST run BEFORE NFKC because
 * NFKC can fold some directional formatting into "visible" glyphs.
 */
export function sanitizeControlChars(
  input: string,
  opts: SanitizeOptions = {},
): string {
  if (typeof input !== 'string' || input.length === 0) return ''
  let s = input.replace(BIDI_ZW_RE, '').replace(CONTROL_RE, '')
  s = s.normalize('NFKC').trim()
  if (opts.maxLen !== undefined && s.length > opts.maxLen) {
    s = s.slice(0, opts.maxLen)
  }
  return s
}
