/**
 * Phase 7 — Import Engine · Default column mappings per format
 *
 * Hardcoded source-header → target-field maps for the three "known"
 * exporters HP supports out of the box. The Generic CSV path has no
 * default — the caller (FE mapping page, or generic-csv tests) supplies
 * a `ColumnMapping` explicitly.
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

export const TALLY_DEFAULT_MAPPING: ColumnMapping = {
  name: 'NAME',
  phone: 'LEDPHONE',
  email: 'EMAIL',
  gstin: 'GSTREGNUMBER',
  address: 'LEDMAILINGADDRESS',
  openingBalance: 'OPENINGBALANCE',
}

export const VYAPAR_DEFAULT_MAPPING: ColumnMapping = {
  name: 'Party Name',
  phone: 'Phone Number',
  email: 'Email',
  gstin: 'GSTIN',
  address: 'Address',
  openingBalance: 'Opening Balance',
}

export const BUSY_DEFAULT_MAPPING: ColumnMapping = {
  name: 'PartyName',
  phone: 'MobileNo',
  email: 'EmailID',
  gstin: 'GSTIN',
  address: 'Address1',
  openingBalance: 'Opening Balance',
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
      return TALLY_DEFAULT_MAPPING
    case 'VYAPAR_CSV':
      return VYAPAR_DEFAULT_MAPPING
    case 'BUSY_XLSX':
      return BUSY_DEFAULT_MAPPING
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
