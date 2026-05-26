/**
 * Phase 7 · 7.1C — Invoice parser shared shapes.
 *
 * Every invoice parser emits a flat `RawInvoiceLineRow[]` — one element
 * per source line. The aggregator (`../aggregator.ts`) groups by
 * `(lower(invoiceNumber), iso(date))` into `RawInvoiceGroup[]` BEFORE
 * staging. Tally XML short-circuits the aggregator: it already nests
 * `<ALLINVENTORYENTRIES.LIST>` items under one `<VOUCHER>`, so its
 * parser emits `preAggregated: true` plus pre-built groups.
 *
 * `sourceIndex` is the **flat row index in the source file** (NOT the
 * line index within an invoice — that's `sourceLineIndex`). Both are
 * surfaced in error chips so the user can locate the bad row in their
 * spreadsheet.
 */

import { ParseError, withTimeout } from '../../parsers/parser.types.js'
import type { ParserContext } from '../../parsers/parser.types.js'

/** Flat per-source-row shape. */
export interface RawInvoiceLineRow {
  /** Row index in the source file (0-based). */
  sourceIndex: number
  /** Header fields — same value across every line of one invoice. */
  invoiceNumber: string | null
  invoiceDate: string | null
  partyName: string | null
  partyPhone: string | null
  partyGstin: string | null
  /** Header totals — source-reported strings (parser does not coerce). */
  subtotal: string | null
  totalCgst: string | null
  totalSgst: string | null
  totalIgst: string | null
  grandTotal: string | null
  notes: string | null
  /** Line fields. */
  sku: string | null
  productName: string | null
  qty: string | null
  unit: string | null
  rate: string | null
  discount: string | null
  taxableValue: string | null
  cgst: string | null
  sgst: string | null
  igst: string | null
  lineTotal: string | null
}

/**
 * Pre-aggregated group emitted by Tally XML parser. Other formats emit
 * `RawInvoiceLineRow[]` and rely on the aggregator.
 */
export interface RawInvoiceGroup {
  /** Flat source index of the FIRST line of this invoice. */
  sourceIndex: number
  header: Omit<RawInvoiceLineRow,
    'sourceIndex' | 'sku' | 'productName' | 'qty' | 'unit' | 'rate'
    | 'discount' | 'taxableValue' | 'cgst' | 'sgst' | 'igst' | 'lineTotal'>
  lines: Array<
    Pick<RawInvoiceLineRow,
      'sku' | 'productName' | 'qty' | 'unit' | 'rate' | 'discount'
      | 'taxableValue' | 'cgst' | 'sgst' | 'igst' | 'lineTotal'>
  >
}

export interface InvoiceParserResult {
  /** `false` → caller MUST run aggregator. `true` → groups are final. */
  preAggregated: boolean
  rows: RawInvoiceLineRow[]
  groups: RawInvoiceGroup[]
  rowCount: number
}

export type InvoiceParser = (
  buffer: Buffer,
  ctx: ParserContext,
) => Promise<InvoiceParserResult>

export { ParseError, withTimeout, type ParserContext }
