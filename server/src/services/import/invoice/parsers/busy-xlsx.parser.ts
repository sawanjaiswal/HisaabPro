/**
 * Phase 7 · 7.1C — Busy XLSX SalesRegister parser.
 *
 * Busy's "Sale Register" tab uses a fixed-ish column set. We look for a
 * sheet whose name matches `SalesRegister` case-insensitively, falling
 * back to the first sheet. Header dictionary mirrors the Vyapar parser
 * — header values are NFKC + lower-cased on parse so source casing is
 * irrelevant.
 *
 * Envelope mirrors 7.1B (busy-xlsx products): zip-bomb pre-scan, parse
 * with `cellFormula:false / cellHTML:false`, JSON-size belt-and-braces.
 */

import * as XLSX from 'xlsx'
import { prescanXlsxArchive } from '../../security/zip-bomb-prescan.js'
import {
  PARSE_TIMEOUT_MS,
  MAX_ROWS,
  XLSX_MAX_UNCOMPRESSED,
} from '../../../../constants/import.constants.js'
import {
  ParseError,
  withTimeout,
  type InvoiceParser,
  type InvoiceParserResult,
  type RawInvoiceLineRow,
} from './parser.types.js'

const HEADER_MAP: Record<string, keyof RawInvoiceLineRow> = {
  invoiceno: 'invoiceNumber',
  invoicenumber: 'invoiceNumber',
  voucherno: 'invoiceNumber',
  invoicedate: 'invoiceDate',
  date: 'invoiceDate',
  partyname: 'partyName',
  customername: 'partyName',
  phoneno: 'partyPhone',
  mobileno: 'partyPhone',
  gstin: 'partyGstin',
  taxableamount: 'subtotal',
  subtotal: 'subtotal',
  cgstamt: 'totalCgst',
  sgstamt: 'totalSgst',
  igstamt: 'totalIgst',
  cgsttotal: 'totalCgst',
  sgsttotal: 'totalSgst',
  igsttotal: 'totalIgst',
  grandtotal: 'grandTotal',
  totalamount: 'grandTotal',
  netamount: 'grandTotal',
  notes: 'notes',
  remarks: 'notes',
  itemcode: 'sku',
  sku: 'sku',
  itemname: 'productName',
  productname: 'productName',
  qty: 'qty',
  quantity: 'qty',
  unit: 'unit',
  uom: 'unit',
  rate: 'rate',
  discount: 'discount',
  taxablevalue: 'taxableValue',
  cgst: 'cgst',
  sgst: 'sgst',
  igst: 'igst',
  linetotal: 'lineTotal',
  amount: 'lineTotal',
}

function normaliseHeader(h: string): string {
  return h.normalize('NFKC').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function emptyRow(index: number): RawInvoiceLineRow {
  return {
    sourceIndex: index,
    invoiceNumber: null, invoiceDate: null,
    partyName: null, partyPhone: null, partyGstin: null,
    subtotal: null, totalCgst: null, totalSgst: null,
    totalIgst: null, grandTotal: null, notes: null,
    sku: null, productName: null, qty: null, unit: null,
    rate: null, discount: null, taxableValue: null,
    cgst: null, sgst: null, igst: null, lineTotal: null,
  }
}

function pickSheet(workbook: XLSX.WorkBook): string {
  const wanted = workbook.SheetNames.find(
    (n) => n.replace(/[^a-z0-9]/gi, '').toLowerCase() === 'salesregister',
  )
  return wanted ?? (workbook.SheetNames[0] ?? '')
}

function recordToRow(
  record: Record<string, unknown>,
  index: number,
): RawInvoiceLineRow | null {
  const row = emptyRow(index)
  let hasContent = false
  for (const srcKey of Object.keys(record)) {
    const mapped = HEADER_MAP[normaliseHeader(srcKey)]
    if (!mapped) continue
    const v = record[srcKey]
    if (v === undefined || v === null) continue
    const s = String(v).trim()
    if (!s) continue
    ;(row as unknown as Record<string, string | null>)[mapped as string] = s
    hasContent = true
  }
  return hasContent ? row : null
}

export const busyInvoiceXlsxParser: InvoiceParser = async (
  buffer,
  _ctx,
): Promise<InvoiceParserResult> => {
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
          `busy invoice xlsx parse failed: ${(e as Error).message}`,
        )
      }
    }),
    PARSE_TIMEOUT_MS,
    'busy-invoice-xlsx',
  )

  const sheetName = pickSheet(workbook)
  if (!sheetName) throw new ParseError('EMPTY_FILE', 'XLSX has no sheets')
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new ParseError('MALFORMED', 'XLSX sheet missing')

  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })
  // Belt-and-braces JSON-size cap (mirrors 7.1B).
  const sliceLen = Math.min(records.length, MAX_ROWS + 1)
  const probe = JSON.stringify(records.slice(0, sliceLen))
  if (probe.length > XLSX_MAX_UNCOMPRESSED) {
    throw new ParseError('FILE_TOO_LARGE', 'XLSX post-parse payload exceeded cap')
  }

  const rows: RawInvoiceLineRow[] = []
  for (let i = 0; i < records.length; i += 1) {
    if (rows.length >= MAX_ROWS) {
      throw new ParseError(
        'FILE_TOO_LARGE',
        `row count exceeded MAX_ROWS=${MAX_ROWS}`,
      )
    }
    const r = recordToRow(records[i] as Record<string, unknown>, rows.length)
    if (r) rows.push(r)
  }
  return {
    preAggregated: false,
    rows,
    groups: [],
    rowCount: rows.length,
  }
}
