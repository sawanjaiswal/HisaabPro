/**
 * Phase 7 — Import Engine · Busy XLSX parser
 *
 * Busy Accounting Software exports parties as an XLSX with a fixed
 * column set. We use SheetJS community edition (xlsx ≥ 0.18) with
 * minimal cell coercion (no formulas, no HTML, no number-format
 * computation) so a malicious workbook can't drive code paths in
 * the library beyond what we need.
 *
 * Cross-references:
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md S10 — pre-scan validates the
 *     central directory, but the parser STILL caps post-parse row count
 *     and JSON-serialized size as a belt-and-suspenders bomb guard.
 *   - ARCHITECTURE §4.3 — pre-scan runs BEFORE library invocation.
 *
 * NOTE: xlsx@0.18.5 is the last public-registry SheetJS CE release;
 * newer versions ship via SheetJS's own CDN. Pin floor 0.18.x.
 */

import * as XLSX from 'xlsx'
import { prescanXlsxArchive } from '../security/zip-bomb-prescan.js'
import {
  PARSE_TIMEOUT_MS,
  MAX_ROWS,
  XLSX_MAX_UNCOMPRESSED,
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

// Busy export column → raw-row key. Phone takes precedence over mobile
// if both are present; address fields are concatenated below.
const COLUMN_MAP: ReadonlyArray<[string, string]> = [
  ['PartyName', 'name'],
  ['PhoneNo', 'phone'],
  ['MobileNo', 'mobile'],
  ['EmailID', 'email'],
  ['GSTIN', 'gstin'],
  ['Opening Balance', 'openingBalance'],
  ['Dr/Cr', 'drCr'],
]

function combineAddress(record: Record<string, unknown>): string {
  const a1 = String(record.Address1 ?? '').trim()
  const a2 = String(record.Address2 ?? '').trim()
  return [a1, a2].filter(Boolean).join(', ')
}

function rowToParty(
  record: Record<string, unknown>,
  index: number,
): RawPartyRow | null {
  const raw: Record<string, string> = {}
  for (const [src, dst] of COLUMN_MAP) {
    const v = record[src]
    if (v === undefined || v === null) continue
    const s = String(v).trim()
    if (s) raw[dst] = s
  }
  if (!raw.name) return null
  if (!raw.phone && raw.mobile) {
    raw.phone = raw.mobile
  }
  const addr = combineAddress(record)
  if (addr) raw.address = addr
  return { sourceIndex: index, raw }
}

export async function busyXlsxParser(
  buffer: Buffer,
  _ctx: ParserContext,
): Promise<ParserResult> {
  if (!buffer || buffer.length === 0) {
    throw new ParseError('EMPTY_FILE', 'XLSX buffer is empty')
  }

  // 1) Pre-scan: zip bomb + path-escape (security/zip-bomb-prescan.ts).
  const scan = await prescanXlsxArchive(buffer)
  if (!scan.safe) {
    throw new ParseError('UNSAFE_ARCHIVE', 'XLSX archive pre-scan rejected')
  }

  // 2) Parse under wall-clock budget. SheetJS is synchronous; we wrap
  //    in Promise.resolve so the timeout has something to race.
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
          `busy xlsx parse failed: ${(e as Error).message}`,
        )
      }
    }),
    PARSE_TIMEOUT_MS,
    'busy-xlsx',
  )

  const sheetName = workbook.SheetNames[0]
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

  // S10 belt-and-suspenders: a malicious workbook could pad cells with
  // megabytes of whitespace that the CD couldn't catch. Cap serialized
  // payload at the same ceiling as XLSX_MAX_UNCOMPRESSED.
  // We slice early to avoid stringifying enormous arrays.
  const sliceLen = Math.min(records.length, MAX_ROWS + 1)
  const probe = JSON.stringify(records.slice(0, sliceLen))
  if (probe.length > XLSX_MAX_UNCOMPRESSED) {
    throw new ParseError(
      'FILE_TOO_LARGE',
      'XLSX post-parse payload exceeded cap',
    )
  }

  const rows: RawPartyRow[] = []
  for (let i = 0; i < records.length; i += 1) {
    if (rows.length >= MAX_ROWS) {
      throw new ParseError(
        'FILE_TOO_LARGE',
        `row count exceeded MAX_ROWS=${MAX_ROWS}`,
      )
    }
    const row = rowToParty(
      records[i] as Record<string, unknown>,
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
