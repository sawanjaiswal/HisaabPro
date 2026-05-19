/**
 * Phase 7 · 7.1C — Aggregator-internal row/header helpers.
 *
 * Carved out of `aggregator.ts` to keep the file ≤250L. Three pure
 * functions:
 *
 *   - `headerFromRow`  — projects a flat parsed row to a `RawInvoiceGroup`
 *                        header (used for the FIRST row of each group).
 *   - `lineFromRow`    — projects a flat parsed row to a line shape.
 *   - `headerEqual`    — compares the stored group header against a new
 *                        line's header fields. Blank/null on the new line
 *                        is treated as "matches" (Vyapar emits header
 *                        values only on the first physical row).
 */

import type { RawInvoiceGroup, RawInvoiceLineRow } from './parsers/parser.types.js'

export const HEADER_FIELDS: ReadonlyArray<
  keyof RawInvoiceGroup['header']
> = [
  'partyName', 'partyPhone', 'partyGstin',
  'subtotal', 'totalCgst', 'totalSgst', 'totalIgst', 'grandTotal',
]

export function headerFromRow(
  row: RawInvoiceLineRow,
  isoDate: string,
): RawInvoiceGroup['header'] {
  return {
    invoiceNumber: row.invoiceNumber,
    invoiceDate: isoDate,
    partyName: row.partyName,
    partyPhone: row.partyPhone,
    partyGstin: row.partyGstin,
    subtotal: row.subtotal,
    totalCgst: row.totalCgst,
    totalSgst: row.totalSgst,
    totalIgst: row.totalIgst,
    grandTotal: row.grandTotal,
    notes: row.notes,
  }
}

export function lineFromRow(
  row: RawInvoiceLineRow,
): RawInvoiceGroup['lines'][number] {
  return {
    sku: row.sku,
    productName: row.productName,
    qty: row.qty,
    unit: row.unit,
    rate: row.rate,
    discount: row.discount,
    taxableValue: row.taxableValue,
    cgst: row.cgst,
    sgst: row.sgst,
    igst: row.igst,
    lineTotal: row.lineTotal,
  }
}

export function headerEqual(
  a: RawInvoiceGroup['header'],
  b: RawInvoiceLineRow,
): { ok: true } | { ok: false; field: string } {
  for (const f of HEADER_FIELDS) {
    const av = (a as Record<string, string | null>)[f as string]
    const bv = (b as unknown as Record<string, string | null>)[f as string]
    const an = av === undefined || av === null || av === '' ? null : av
    const bn = bv === undefined || bv === null || bv === '' ? null : bv
    if (an !== null && bn !== null && an !== bn) {
      return { ok: false, field: f as string }
    }
  }
  return { ok: true }
}
