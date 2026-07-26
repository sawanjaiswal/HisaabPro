/**
 * Phase 7 — Import Engine · Vyapar CSV parser
 *
 * Vyapar's "Parties" export uses fixed column names. This parser maps
 * those columns into the shared `RawPartyRow` shape. CSV-injection
 * defence is owned by the normalization layer (API.4); this parser
 * just shuttles strings.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §4.4
 *   - Vyapar Help Center: Party CSV export columns (May 2025 schema)
 */

import Papa from 'papaparse'
import {
  PARSE_TIMEOUT_MS,
  MAX_ROWS,
} from '../../../constants/import.constants.js'
import type {
  RawPartyRow,
  ParserResult,
} from '../../../types/import.types.js'
import {
  ParseError,
  withTimeout,
  type ParserContext,
} from './parser.types.js'

// Allowed values in the "Type" column. We let "Both" through because
// Vyapar uses it for parties that are both customer + supplier; the
// downstream classifier handles it.
const ALLOWED_TYPES = new Set(['customer', 'supplier', 'both', ''])

// Source column → raw-row key. Keeping the mapping table local so a
// renamed Vyapar column is a one-line patch.
const COLUMN_MAP: ReadonlyArray<[string, string]> = [
  ['Party Name', 'name'],
  ['Phone Number', 'phone'],
  ['Email', 'email'],
  ['GSTIN', 'gstin'],
  ['Address', 'address'],
  ['Opening Balance', 'openingBalance'],
  ['Type', 'type'],
]

function stripBom(s: string): string {
  // Vyapar exports occasionally include a UTF-8 BOM (0xFEFF) on the
  // first cell of row 1, which breaks header matching for "Party Name".
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
}

function rowToParty(
  record: Record<string, string>,
  index: number,
): RawPartyRow | null {
  const raw: Record<string, string> = {}
  for (const [src, dst] of COLUMN_MAP) {
    const v = record[src]
    if (typeof v === 'string' && v.trim()) raw[dst] = v.trim()
  }
  // A missing name is NOT a reason to drop the line. The normalizer flags it
  // (MISSING_NAME) and the row previews as an error the shop can see and fix —
  // dropping it here would make the file's row count and the preview's
  // disagree with nothing to explain the difference.
  const type = (raw.type || '').toLowerCase()
  // The Type filter stays: an expense ledger is not a party at all, so it is
  // not a row this import is about.
  if (!ALLOWED_TYPES.has(type)) return null

  return { sourceIndex: index, raw }
}

export async function vyaparCsvParser(
  buffer: Buffer,
  _ctx: ParserContext,
): Promise<ParserResult> {
  if (!buffer || buffer.length === 0) {
    throw new ParseError('EMPTY_FILE', 'CSV buffer is empty')
  }

  const text = stripBom(buffer.toString('utf8'))

  const parsed = await withTimeout(
    Promise.resolve().then(() => {
      const r = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h) => stripBom(h).trim(),
      })
      if (r.errors && r.errors.length > 0) {
        // Papa surfaces a delimiter / header error here. Treat as
        // MALFORMED rather than empty so the user sees the right banner.
        const fatal = r.errors.find((e) => e.type === 'Delimiter')
        if (fatal) {
          throw new ParseError(
            'MALFORMED',
            `vyapar csv parse failed: ${fatal.message}`,
          )
        }
      }
      return r.data
    }),
    PARSE_TIMEOUT_MS,
    'vyapar-csv',
  )

  const rows: RawPartyRow[] = []
  for (let i = 0; i < parsed.length; i += 1) {
    if (rows.length >= MAX_ROWS) {
      throw new ParseError(
        'FILE_TOO_LARGE',
        `row count exceeded MAX_ROWS=${MAX_ROWS}`,
      )
    }
    const row = rowToParty(parsed[i] as Record<string, string>, rows.length)
    if (row) rows.push(row)
  }

  return {
    rows,
    rowCount: rows.length,
    rejectedCount: 0,
  }
}
