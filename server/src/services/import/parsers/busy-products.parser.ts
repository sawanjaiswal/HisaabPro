/**
 * Phase 7 · 7.1B — Busy ItemMaster XLSX parser
 *
 * Reuses the same SheetJS envelope as busy-xlsx.parser.ts (parties),
 * with a different column map. Zip-bomb pre-scan + post-parse size
 * cap inherited.
 */

import * as XLSX from 'xlsx'
import { prescanXlsxArchive } from '../security/zip-bomb-prescan.js'
import {
  PARSE_TIMEOUT_MS,
  MAX_ROWS,
  XLSX_MAX_UNCOMPRESSED,
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
  ['ItemName', 'name'],
  ['Item Name', 'name'],
  ['AliasCode', 'sku'],
  ['ItemCode', 'sku'],
  ['HSNCode', 'hsn'],
  ['HSN', 'hsn'],
  ['Unit', 'unit'],
  ['MainUnit', 'unit'],
  ['SalePrice', 'salePrice'],
  ['PurchasePrice', 'purchasePrice'],
  ['MRP', 'mrp'],
  ['OpeningStock', 'openingStock'],
  ['OpeningQty', 'openingStock'],
  ['Description', 'description'],
]

function rowToProduct(
  record: Record<string, unknown>,
  index: number,
): RawProductRow | null {
  const raw: Record<string, string> = {}
  for (const [src, dst] of COLUMN_MAP) {
    const v = record[src]
    if (v === undefined || v === null) continue
    const s = String(v).trim()
    if (!s) continue
    if (!raw[dst]) raw[dst] = s
  }
  if (!raw.name) return null
  return { sourceIndex: index, raw }
}

function pickItemSheet(workbook: XLSX.WorkBook): string | undefined {
  // Prefer a sheet literally named ItemMaster / Items, else first.
  const preferred = workbook.SheetNames.find((n) =>
    /item/i.test(n),
  )
  return preferred ?? workbook.SheetNames[0]
}

export async function busyProductsParser(
  buffer: Buffer,
  _ctx: ParserContext,
): Promise<ParserResult> {
  if (!buffer || buffer.length === 0) {
    throw new ParseError('EMPTY_FILE', 'XLSX buffer is empty')
  }
  const scan = await prescanXlsxArchive(buffer)
  if (!scan.safe) {
    throw new ParseError('UNSAFE_ARCHIVE', 'XLSX archive pre-scan rejected')
  }
  const workbook = await withTimeout(
    Promise.resolve().then(() => {
      try {
        return XLSX.read(buffer, {
          type: 'buffer',
          cellHTML: false,
          cellFormula: false,
          cellNF: false,
          cellDates: false,
          cellStyles: false,
        })
      } catch (e) {
        throw new ParseError(
          'MALFORMED',
          `busy products xlsx parse failed: ${(e as Error).message}`,
        )
      }
    }),
    PARSE_TIMEOUT_MS,
    'busy-products',
  )
  const sheetName = pickItemSheet(workbook)
  if (!sheetName) {
    throw new ParseError('EMPTY_FILE', 'XLSX has no sheets')
  }
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new ParseError('MALFORMED', 'XLSX sheet missing from workbook')
  }
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })
  const sliceLen = Math.min(records.length, MAX_ROWS + 1)
  const probe = JSON.stringify(records.slice(0, sliceLen))
  if (probe.length > XLSX_MAX_UNCOMPRESSED) {
    throw new ParseError(
      'FILE_TOO_LARGE',
      'XLSX post-parse payload exceeded cap',
    )
  }
  const rows: RawProductRow[] = []
  for (let i = 0; i < records.length; i += 1) {
    if (rows.length >= MAX_ROWS) {
      throw new ParseError(
        'FILE_TOO_LARGE',
        `row count exceeded MAX_ROWS=${MAX_ROWS}`,
      )
    }
    const row = rowToProduct(
      records[i] as Record<string, unknown>,
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
