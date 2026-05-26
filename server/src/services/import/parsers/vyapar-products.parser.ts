/**
 * Phase 7 · 7.1B — Vyapar product CSV parser
 *
 * Vyapar's "Items" export uses a fixed column set. We map it onto
 * RawProductRow. CSV-injection defence + sanitisation owned downstream
 * by the normalizer (M6).
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

const COLUMN_MAP: ReadonlyArray<[string, string]> = [
  ['Item Name', 'name'],
  ['Item Code', 'sku'],
  ['HSN', 'hsn'],
  ['HSN Code', 'hsn'],
  ['Unit', 'unit'],
  ['Sale Price', 'salePrice'],
  ['Purchase Price', 'purchasePrice'],
  ['MRP', 'mrp'],
  ['Opening Stock', 'openingStock'],
  ['Description', 'description'],
]

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
}

function rowToProduct(
  record: Record<string, string>,
  index: number,
): RawProductRow | null {
  const raw: Record<string, string> = {}
  for (const [src, dst] of COLUMN_MAP) {
    const v = record[src]
    if (typeof v === 'string' && v.trim()) {
      if (!raw[dst]) raw[dst] = v.trim()
    }
  }
  if (!raw.name) return null
  return { sourceIndex: index, raw }
}

export async function vyaparProductsParser(
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
            `vyapar products csv parse failed: ${fatal.message}`,
          )
        }
      }
      return r.data
    }),
    PARSE_TIMEOUT_MS,
    'vyapar-products',
  )
  const rows: RawProductRow[] = []
  for (let i = 0; i < parsed.length; i += 1) {
    if (rows.length >= MAX_ROWS) {
      throw new ParseError(
        'FILE_TOO_LARGE',
        `row count exceeded MAX_ROWS=${MAX_ROWS}`,
      )
    }
    const row = rowToProduct(parsed[i] as Record<string, string>, rows.length)
    if (row) rows.push(row)
  }
  return {
    rows: rows as unknown as ParserResult['rows'],
    rowCount: rows.length,
    rejectedCount: 0,
  }
}
