/**
 * Phase 7 — Import Engine · Default column mappings per format
 *
 * The mapping the normalizer applies for each format. For the three "known"
 * exporters the parser has already canonicalised the row, so the mapping is the
 * identity over canonical keys — the source headers themselves belong to the
 * parsers. The Generic CSV path has no default: it preserves the file's own
 * headers on purpose, and the caller (FE mapping page) supplies the mapping.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md File Plan row 9
 *   - SCOPE_PHASE7_IMPORT_7_1A_PARTIES.md "Format coverage"
 */

import type { ImportFormat } from '../../../types/import.types.js'

/**
 * Source-header names per HP target-field. All keys are HP fields; all
 * values are the literal header strings the exporter emits. Values are
 * matched case-insensitively by the normalizer so trivial casing drift
 * in user files doesn't break ingestion.
 */
export interface ColumnMapping {
  name: string
  phone?: string
  email?: string
  gstin?: string
  address?: string
  openingBalance?: string
}

/**
 * The shape every known-format parser emits.
 *
 * Source header names live in ONE place — each parser's own `COLUMN_MAP`, which
 * is what reads the file. By the time a row reaches the normalizer the parser
 * has already renamed those headers to these canonical keys, so the mapping
 * applied downstream is the identity over them. Naming source headers here
 * instead (`'Party Name'`, `'MobileNo'`, …) made every lookup miss, which
 * surfaced as `MISSING_NAME` on every row of every Vyapar / Busy import.
 * See .claude/fix-trace-import-mapping-source-headers.md.
 */
export const PARSER_CANONICAL_MAPPING: ColumnMapping = {
  name: 'name',
  phone: 'phone',
  email: 'email',
  gstin: 'gstin',
  address: 'address',
  openingBalance: 'openingBalance',
}

/**
 * Returns the default mapping for a known format, or `null` for
 * `GENERIC_CSV` — the FE mapping page collects user choice explicitly.
 */
export function defaultMappingFor(
  format: ImportFormat,
): ColumnMapping | null {
  switch (format) {
    case 'TALLY_XML':
    case 'VYAPAR_CSV':
    case 'BUSY_XLSX':
      return PARSER_CANONICAL_MAPPING
    case 'GENERIC_CSV':
      return null
    default: {
      // Exhaustiveness guard: TS error if a new format is added without
      // a mapping entry above.
      const _exhaustive: never = format
      void _exhaustive
      return null
    }
  }
}
