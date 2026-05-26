/**
 * Phase 7 · 7.1B — Generic product CSV parser
 *
 * Header-preserving CSV shuttle. The downstream column-mapping step
 * tells the normalizer which source columns map to canonical product
 * fields.
 */

import Papa from 'papaparse'
import {
  PARSE_TIMEOUT_MS,
  MAX_ROWS,
} from '../../../constants/import.constants.js'
import type {
  RawProductRow,
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
): RawProductRow | null {
  const raw: Record<string, string> = {}
  let hasContent = false
  for (const key of Object.keys(record)) {
    if (!key) continue
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

export async function genericProductsParser(
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
            `generic products csv parse failed: ${fatal.message}`,
          )
        }
      }
      return r.data
    }),
    PARSE_TIMEOUT_MS,
    'generic-products',
  )
  const rows: RawProductRow[] = []
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
    rows: rows as unknown as ParserResult['rows'],
    rowCount: rows.length,
    rejectedCount: 0,
  }
}
