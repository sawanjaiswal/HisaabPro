/**
 * Phase 7 — Import Engine · Generic CSV parser
 *
 * Accepts any header set. The downstream column-mapping step (API.4)
 * tells the normalizer how to map source columns onto canonical party
 * fields; this parser is just a header-preserving CSV → JSON shuttle.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §4.5
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

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
}

function recordToRow(
  record: Record<string, string>,
  index: number,
): RawPartyRow | null {
  const raw: Record<string, string> = {}
  let hasContent = false
  for (const key of Object.keys(record)) {
    if (!key) continue // Papa emits '' header for empty trailing cols
    const v = record[key]
    if (typeof v !== 'string') continue
    const trimmed = v.trim()
    if (!trimmed) continue
    raw[key] = trimmed
    hasContent = true
  }
  if (!hasContent) return null
  return { sourceIndex: index, raw }
}

export async function genericCsvParser(
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
        const fatal = r.errors.find((e) => e.type === 'Delimiter')
        if (fatal) {
          throw new ParseError(
            'MALFORMED',
            `generic csv parse failed: ${fatal.message}`,
          )
        }
      }
      return r.data
    }),
    PARSE_TIMEOUT_MS,
    'generic-csv',
  )

  const rows: RawPartyRow[] = []
  for (let i = 0; i < parsed.length; i += 1) {
    if (rows.length >= MAX_ROWS) {
      throw new ParseError(
        'FILE_TOO_LARGE',
        `row count exceeded MAX_ROWS=${MAX_ROWS}`,
      )
    }
    const row = recordToRow(
      parsed[i] as Record<string, string>,
      rows.length,
    )
    if (row) rows.push(row)
  }

  return {
    rows,
    rowCount: rows.length,
    rejectedCount: 0,
  }
}
