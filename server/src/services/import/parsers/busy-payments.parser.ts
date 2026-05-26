/**
 * Phase 7 · 7.1D PR-D2b — Busy ReceiptRegister XLSX parser.
 *
 * Walks the (case-insensitive) "ReceiptRegister" sheet in a Busy export,
 * mapping headers via the shared payment-column-dict.
 *
 * Critical: `sheet_to_json` is invoked with `{ cellDates: true,
 * dateNF: 'yyyy-mm-dd' }` (Resolved Decision #29) so Excel-serial date
 * cells (e.g. `45291`) materialise as ISO strings BEFORE downstream
 * code sees them. Without this, `Date(serial)` arithmetic shifts by
 * timezone and 1900-leap bugs slip through.
 *
 * Authority:
 *   - SCOPE_PHASE7_IMPORT_7_1D_PAYMENTS.md §8 (L431-440)
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1D.md §4 row busy-xlsx.parser.ts
 */

import * as XLSX from 'xlsx'
import { prescanXlsxArchive } from '../security/zip-bomb-prescan.js'
import {
  PARSE_TIMEOUT_MS,
  MAX_ROWS,
  XLSX_MAX_UNCOMPRESSED,
} from '../../../constants/import.constants.js'
import type {
  RawPaymentRow,
  ParserResult,
} from '../../../types/import.types.js'
import {
  ParseError,
  withTimeout,
  type ParserContext,
} from './parser.types.js'
import {
  resolveHeader,
  type PaymentCanonicalKey,
} from './payment-column-dict.constants.js'

/** Prefer ReceiptRegister-like sheet name, else first sheet. */
function pickReceiptSheet(workbook: XLSX.WorkBook): string | undefined {
  const preferred = workbook.SheetNames.find((n) => /receipt/i.test(n))
  return preferred ?? workbook.SheetNames[0]
}

function recordToRow(
  record: Record<string, unknown>,
  headerMap: Map<string, PaymentCanonicalKey>,
  index: number,
): RawPaymentRow | null {
  const raw: Record<string, string> = {}
  let hasContent = false
  for (const [source, canonical] of headerMap) {
    const v = record[source]
    if (v === undefined || v === null) continue
    const s = String(v).trim()
    if (!s) continue
    raw[canonical] = s
    hasContent = true
  }
  if (!hasContent) return null
  // SCOPE L437: skip merged-cell title rows (no date column).
  if (!raw.date && !raw.partyName && !raw.amount) return null
  return { sourceIndex: index, raw }
}

function buildHeaderMap(
  records: Record<string, unknown>[],
): Map<string, PaymentCanonicalKey> {
  const m = new Map<string, PaymentCanonicalKey>()
  if (records.length === 0) return m
  const seen = new Set<PaymentCanonicalKey>()
  // Use the union of keys from the first 5 rows — Busy occasionally
  // omits columns whose entire run is blank in early rows.
  const sample = records.slice(0, 5)
  const headers = new Set<string>()
  for (const r of sample) {
    for (const k of Object.keys(r)) headers.add(k)
  }
  for (const h of headers) {
    const canonical = resolveHeader(h)
    if (canonical === null) continue
    if (seen.has(canonical)) continue
    m.set(h, canonical)
    seen.add(canonical)
  }
  return m
}

export async function busyPaymentsParser(
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
          cellDates: true, // Resolved Decision #29
          cellStyles: false,
        })
      } catch (e) {
        throw new ParseError(
          'MALFORMED',
          `busy payments xlsx parse failed: ${(e as Error).message}`,
        )
      }
    }),
    PARSE_TIMEOUT_MS,
    'busy-payments',
  )
  const sheetName = pickReceiptSheet(workbook)
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
    dateNF: 'yyyy-mm-dd', // Resolved Decision #29
  })
  const sliceLen = Math.min(records.length, MAX_ROWS + 1)
  const probe = JSON.stringify(records.slice(0, sliceLen))
  if (probe.length > XLSX_MAX_UNCOMPRESSED) {
    throw new ParseError(
      'FILE_TOO_LARGE',
      'XLSX post-parse payload exceeded cap',
    )
  }
  const headerMap = buildHeaderMap(records)
  const rows: RawPaymentRow[] = []
  for (let i = 0; i < records.length; i += 1) {
    if (rows.length >= MAX_ROWS) {
      throw new ParseError(
        'FILE_TOO_LARGE',
        `row count exceeded MAX_ROWS=${MAX_ROWS}`,
      )
    }
    const row = recordToRow(
      records[i] as Record<string, unknown>,
      headerMap,
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
