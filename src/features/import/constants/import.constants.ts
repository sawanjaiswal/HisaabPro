/**
 * Phase 7 Slice 7.1A — Import constants.
 * Limits SSOT-mirrored from server (see ARCHITECTURE §2/§3).
 */

import type { ImportFormat } from '../types/import.types'

/** Maximum upload size — server-side cap is identical (10 MB). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

/** Minimum client version required by the route middleware. */
export const IMPORT_MIN_CLIENT_VERSION = '7.1.0'

/** Translation-key suffix per format. Resolved as `t.importFormat_<value>`. */
export interface FormatOption {
  value: ImportFormat
  labelKey: string
  descKey: string
  /** Allowed file extensions (lowercase, no dot). */
  extensions: readonly string[]
  /** The accept attribute for <input type="file">. */
  accept: string
}

export const FORMAT_OPTIONS: readonly FormatOption[] = [
  {
    value: 'tally_xml',
    labelKey: 'importFormatTallyXmlLabel',
    descKey: 'importFormatTallyXmlDesc',
    extensions: ['xml'],
    accept: '.xml,text/xml,application/xml',
  },
  {
    value: 'vyapar_csv',
    labelKey: 'importFormatVyaparCsvLabel',
    descKey: 'importFormatVyaparCsvDesc',
    extensions: ['csv'],
    accept: '.csv,text/csv',
  },
  {
    value: 'busy_xls',
    labelKey: 'importFormatBusyXlsLabel',
    descKey: 'importFormatBusyXlsDesc',
    extensions: ['xlsx', 'xls'],
    accept: '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel',
  },
  {
    value: 'generic_csv',
    labelKey: 'importFormatGenericCsvLabel',
    descKey: 'importFormatGenericCsvDesc',
    extensions: ['csv'],
    accept: '.csv,text/csv',
  },
] as const

/** Union of every accepted extension (used by drop-zone). */
export const ACCEPTED_EXTENSIONS = ['xml', 'csv', 'xlsx', 'xls'] as const

/** Combined `accept` attribute for the file input. */
export const ACCEPTED_INPUT_ACCEPT =
  '.xml,.csv,.xlsx,.xls,text/xml,application/xml,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
