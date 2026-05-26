/**
 * Phase 7 · 7.1C — Generic invoice CSV parser.
 *
 * Header dictionary from SCOPE L55 (verbatim):
 *
 *   invoice_number, invoice_date, party_name, party_phone, sku,
 *   item_name, qty, rate, gst_rate, line_total, total_amount
 *
 * Plus optional `cgst`, `sgst`, `igst`, `discount`, `taxable_value`,
 * `unit`, `notes`. Headers are lowercased + underscore-normalised on
 * parse, so `Invoice Number` / `invoice-number` / `INVOICE_NUMBER` all
 * resolve to the same key.
 *
 * The aggregator handles multi-line groups.
 */

import Papa from 'papaparse'
import {
  PARSE_TIMEOUT_MS,
  MAX_ROWS,
} from '../../../../constants/import.constants.js'
import {
  ParseError,
  withTimeout,
  type InvoiceParser,
  type InvoiceParserResult,
  type RawInvoiceLineRow,
} from './parser.types.js'

const HEADER_MAP: Record<string, keyof RawInvoiceLineRow> = {
  invoice_number: 'invoiceNumber',
  invoice_no: 'invoiceNumber',
  invoice_date: 'invoiceDate',
  date: 'invoiceDate',
  party_name: 'partyName',
  customer_name: 'partyName',
  party_phone: 'partyPhone',
  phone: 'partyPhone',
  party_gstin: 'partyGstin',
  gstin: 'partyGstin',
  subtotal: 'subtotal',
  taxable_amount: 'subtotal',
  cgst_total: 'totalCgst',
  sgst_total: 'totalSgst',
  igst_total: 'totalIgst',
  total_amount: 'grandTotal',
  grand_total: 'grandTotal',
  notes: 'notes',
  description: 'notes',
  sku: 'sku',
  item_code: 'sku',
  item_name: 'productName',
  product_name: 'productName',
  qty: 'qty',
  quantity: 'qty',
  unit: 'unit',
  rate: 'rate',
  discount: 'discount',
  taxable_value: 'taxableValue',
  cgst: 'cgst',
  sgst: 'sgst',
  igst: 'igst',
  gst_rate: 'cgst', // legacy alias — treat as cgst for safety
  line_total: 'lineTotal',
  amount: 'lineTotal',
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
}

function normaliseHeader(h: string): string {
  return stripBom(h).trim().toLowerCase().replace(/[\s\-]+/g, '_')
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

function recordToRow(
  record: Record<string, string>,
  index: number,
): RawInvoiceLineRow | null {
  const row = emptyRow(index)
  let hasContent = false
  for (const key of Object.keys(record)) {
    const mapped = HEADER_MAP[key]
    if (!mapped) continue
    const v = record[key]
    if (typeof v !== 'string') continue
    const trimmed = v.trim()
    if (!trimmed) continue
    ;(row as unknown as Record<string, string | null>)[mapped as string] = trimmed
    hasContent = true
  }
  return hasContent ? row : null
}

export const genericInvoiceCsvParser: InvoiceParser = async (
  buffer,
  _ctx,
): Promise<InvoiceParserResult> => {
  if (!buffer || buffer.length === 0) {
    throw new ParseError('EMPTY_FILE', 'CSV buffer is empty')
  }
  const text = stripBom(buffer.toString('utf8'))
  const parsed = await withTimeout(
    Promise.resolve().then(() => {
      const r = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: normaliseHeader,
      })
      if (r.errors && r.errors.length > 0) {
        const fatal = r.errors.find((e) => e.type === 'Delimiter')
        if (fatal) {
          throw new ParseError(
            'MALFORMED',
            `generic invoice csv parse failed: ${fatal.message}`,
          )
        }
      }
      return r.data
    }),
    PARSE_TIMEOUT_MS,
    'generic-invoice-csv',
  )

  const rows: RawInvoiceLineRow[] = []
  for (let i = 0; i < parsed.length; i += 1) {
    if (rows.length >= MAX_ROWS) {
      throw new ParseError(
        'FILE_TOO_LARGE',
        `row count exceeded MAX_ROWS=${MAX_ROWS}`,
      )
    }
    const r = recordToRow(parsed[i] as Record<string, string>, rows.length)
    if (r) rows.push(r)
  }
  return {
    preAggregated: false,
    rows,
    groups: [],
    rowCount: rows.length,
  }
}
