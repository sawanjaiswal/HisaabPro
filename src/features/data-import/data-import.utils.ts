/** Competitor Data Import — Pure utility functions */

import { KNOWN_COLUMN_MAPS, MAX_IMPORT_ROWS } from './data-import.constants'
import type { ImportDataType, ImportedRow, ColumnMapping } from './data-import.types'

/**
 * Parse CSV text into rows with headers.
 */
export function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length && rows.length < MAX_IMPORT_ROWS; i++) {
    const cols = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = cols[idx]?.trim() ?? ''
    })
    rows.push(row)
  }

  return { headers, rows }
}

/** Parse a single CSV line handling quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

/**
 * Auto-detect column mappings based on known column names.
 */
export function autoDetectMappings(
  headers: string[],
  dataType: ImportDataType,
): ColumnMapping[] {
  const knownMap = KNOWN_COLUMN_MAPS[dataType] ?? {}
  const mappings: ColumnMapping[] = []

  for (const header of headers) {
    const lower = header.toLowerCase().trim()
    const target = knownMap[lower]
    if (target) {
      mappings.push({ sourceColumn: header, targetField: target })
    }
  }

  return mappings
}

/**
 * Apply column mappings to raw rows, producing ImportedRow[].
 */
export function applyMappings(
  rows: Record<string, string>[],
  mappings: ColumnMapping[],
): ImportedRow[] {
  return rows.map((raw, i) => {
    const mapped: Record<string, string> = {}
    for (const m of mappings) {
      if (raw[m.sourceColumn] !== undefined) {
        mapped[m.targetField] = raw[m.sourceColumn]
      }
    }

    // Basic validation
    const isValid = Boolean(mapped.name?.trim())
    const error = isValid ? undefined : 'Missing name'

    return {
      id: `row-${i}`,
      raw,
      mapped,
      isValid,
      error,
    }
  })
}

/**
 * Get target fields for a given data type.
 */
export function getTargetFields(dataType: ImportDataType): string[] {
  switch (dataType) {
    case 'PARTIES':
      return ['name', 'phone', 'email', 'type', 'gstin', 'address', 'city', 'state', 'pincode', 'openingBalance']
    case 'PRODUCTS':
      return ['name', 'hsn', 'unit', 'rate', 'purchasePrice', 'stock', 'barcode']
    case 'INVOICES':
      return ['invoiceNumber', 'date', 'partyName', 'amount']
    default:
      return []
  }
}
