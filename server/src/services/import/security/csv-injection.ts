/**
 * Phase 7 — Import Engine · CSV / spreadsheet-injection sanitiser
 *
 * Cross-references:
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md §S12 — the sanitiser must also
 *     run on the preview JSON serialiser, not just CSV exports. A cell
 *     stored as `=cmd|'/c calc'!A0` and later previewed in any
 *     spreadsheet (the dedup-conflict CSV download, the failed-rows CSV,
 *     even an admin Excel copy-paste) is a Formula Injection vector.
 *     We prefix-neutralise at ingest-preview boundary, so downstream
 *     consumers cannot accidentally trigger formula evaluation.
 *
 * Pure: no I/O, no deps.
 */

// Spreadsheet formula triggers — OWASP recommended set.
// Tab / CR are included because Excel will silently turn them into
// leading whitespace and then re-interpret the cell when copied.
const UNSAFE_PREFIXES: ReadonlyArray<string> = ['=', '+', '-', '@', '\t', '\r']

/**
 * Prefixes a single string cell with a leading apostrophe if its first
 * character is one of the OWASP formula-trigger characters. Returns the
 * value unchanged otherwise (including empty strings).
 */
export function prefixUnsafeCell(value: string): string {
  if (typeof value !== 'string' || value.length === 0) return value
  if (UNSAFE_PREFIXES.includes(value.charAt(0))) {
    return `'${value}`
  }
  return value
}

/**
 * Applies `prefixUnsafeCell` to every string value in a row. Used by the
 * CSV emitter (failed-rows export, dedup-conflict download).
 */
export function sanitizeCsvRow(
  row: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.keys(row)) {
    out[key] = prefixUnsafeCell(row[key] ?? '')
  }
  return out
}

/**
 * S12 fix — the preview JSON shape contains heterogeneous values (string
 * cells from the user's spreadsheet alongside numbers / booleans we
 * inferred). We only prefix actual strings; numbers / booleans / null
 * cannot trigger Excel formula evaluation when re-exported.
 *
 * Recursive descent is intentionally avoided: preview rows are flat
 * { columnName -> primitive } maps by contract (see ARCH §4.4).
 */
export function sanitizeForPreviewJson(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    const v = row[key]
    out[key] = typeof v === 'string' ? prefixUnsafeCell(v) : v
  }
  return out
}
