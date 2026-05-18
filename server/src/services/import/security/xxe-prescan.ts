/**
 * Phase 7 — Import Engine · XXE / billion-laughs pre-scan
 *
 * Cross-references:
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md S1 — scan FULL buffer (not just
 *     the first N bytes); the upload cap (MAX_FILE_SIZE_BYTES = 10MB) is
 *     the actual ceiling. A 9.9MB whitespace prefix followed by `<!DOCTYPE`
 *     must still trip the guard.
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §4.2 — XXE pre-scan runs BEFORE
 *     any XML parser instantiation (fast-xml-parser ≥ 4.4.0 per S2).
 *
 * Pure: no I/O, no DB. Pure regex on Buffer's UTF-8 view.
 */

import { XXE_SCAN_BYTES } from '../../../constants/import.constants.js'

/** Error code surfaced to upload route on unsafe XML detection. */
export const UNSAFE_XML = 'UNSAFE_XML' as const

export interface XxeScanResult {
  safe: boolean
  reason?: typeof UNSAFE_XML
}

// Hostile XML declarations we never want fed to a parser.
// - <!DOCTYPE   → external/internal DTD subset, root of XXE + billion-laughs
// - <!ENTITY    → entity declarations (Lol1 / Lol2 / file:// retrieval)
// - <![CDATA[   → harmless on its own, but combined with ENTITY it hides
//                 the payload; cheap to reject outright since legitimate
//                 Tally/Vyapar exports do not need CDATA inside billing rows.
const UNSAFE_TOKENS: ReadonlyArray<RegExp> = [
  /<!DOCTYPE/i,
  /<!ENTITY/i,
  /<!\[CDATA\[/i,
]

/**
 * Scan an upload buffer for XML constructs that enable XXE, billion-laughs,
 * or out-of-band data exfiltration. Returns `{ safe: false }` on first hit;
 * caller maps that to HTTP 400 + the `UNSAFE_XML` error code.
 *
 * The scan is bounded by the smaller of (buffer length, XXE_SCAN_BYTES).
 * Since multer rejects uploads larger than MAX_FILE_SIZE_BYTES (10MB) and
 * XXE_SCAN_BYTES is set to the same value, we always scan the full payload.
 */
export function scanForXxe(buffer: Buffer): XxeScanResult {
  if (!buffer || buffer.length === 0) {
    return { safe: true }
  }

  const limit = Math.min(buffer.length, XXE_SCAN_BYTES)
  // toString('utf8', 0, limit) is the cheapest way to apply the regexes;
  // for a 10MB buffer this allocates one string but stays well under
  // PARSE_TIMEOUT_MS budget (typical scan: ~30ms on a slow Pi-class box).
  const text = buffer.toString('utf8', 0, limit)

  for (const re of UNSAFE_TOKENS) {
    if (re.test(text)) {
      return { safe: false, reason: UNSAFE_XML }
    }
  }

  return { safe: true }
}
