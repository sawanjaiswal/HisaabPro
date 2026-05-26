/**
 * Phase 7 · 7.1C — Vyapar sales-register CSV parser.
 *
 * Vyapar's "Sale Register" export flattens one invoice line per row. The
 * header dictionary is fixed; trailing alias columns are ignored. The
 * aggregator (`../aggregator.ts`) groups rows by `(invoiceNumber, date)`
 * post-parse — this parser is a header-mapped shuttle only.
 *
 * Envelope mirrors 7.1B (vyapar-csv parties): BOM strip, header NFKC,
 * PapaParse with `transformHeader` trim, 10s race timeout, MAX_ROWS cap.
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

// Vyapar source-column → RawInvoiceLineRow key. Case-insensitive match
// via lowercased header during parse.
const COLUMN_MAP: ReadonlyArray<[string, keyof RawInvoiceLineRow]> = [
  ['invoice number', 'invoiceNumber'],
  ['invoice no', 'invoiceNumber'],
  ['invoice date', 'invoiceDate'],
  ['date', 'invoiceDate'],
  ['party name', 'partyName'],
  ['customer name', 'partyName'],
  ['phone number', 'partyPhone'],
  ['phone', 'partyPhone'],
  ['gstin', 'partyGstin'],
  ['party gstin', 'partyGstin'],
  ['subtotal', 'subtotal'],
  ['taxable amount', 'subtotal'],
  ['cgst amount', 'totalCgst'],
  ['sgst amount', 'totalSgst'],
  ['igst amount', 'totalIgst'],
  ['total amount', 'grandTotal'],
  ['grand total', 'grandTotal'],
  ['notes', 'notes'],
  ['description', 'notes'],
  ['item code', 'sku'],
  ['sku', 'sku'],
  ['item name', 'productName'],
  ['product name', 'productName'],
  ['quantity', 'qty'],
  ['qty', 'qty'],
  ['unit', 'unit'],
  ['rate', 'rate'],
  ['price per unit', 'rate'],
  ['discount', 'discount'],
  ['taxable value', 'taxableValue'],
  ['cgst', 'cgst'],
  ['sgst', 'sgst'],
  ['igst', 'igst'],
  ['line total', 'lineTotal'],
  ['amount', 'lineTotal'],
]

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
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
): RawInvoiceLineRow {
  const row = emptyRow(index)
  let hasContent = false
  for (const [header, key] of COLUMN_MAP) {
    const v = record[header]
    if (typeof v !== 'string') continue
    const trimmed = v.trim()
    if (!trimmed) continue
    // Object index narrowed via known-string union; safe write.
    ;(row as unknown as Record<string, string | null>)[key as string] = trimmed
    hasContent = true
  }
  return hasContent ? row : { ...row, sourceIndex: index }
}

export const vyaparInvoiceCsvParser: InvoiceParser = async (
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
        transformHeader: (h) => stripBom(h).trim().toLowerCase(),
      })
      if (r.errors && r.errors.length > 0) {
        const fatal = r.errors.find((e) => e.type === 'Delimiter')
        if (fatal) {
          throw new ParseError(
            'MALFORMED',
            `vyapar invoice csv parse failed: ${fatal.message}`,
          )
        }
      }
      return r.data
    }),
    PARSE_TIMEOUT_MS,
    'vyapar-invoice-csv',
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
    // Keep only rows with at least an invoice number OR a product field.
    if (r.invoiceNumber || r.productName || r.sku) rows.push(r)
  }
  return {
    preAggregated: false,
    rows,
    groups: [],
    rowCount: rows.length,
  }
}
