import { describe, expect, it } from 'vitest'
import { aggregateInvoiceRows } from '../aggregator.js'
import { LINES_PER_INVOICE_CAP } from '../invoice.constants.js'
import type { RawInvoiceLineRow } from '../parsers/parser.types.js'

function row(o: Partial<RawInvoiceLineRow> & { sourceIndex: number }): RawInvoiceLineRow {
  return {
    invoiceNumber: null, invoiceDate: null,
    partyName: null, partyPhone: null, partyGstin: null,
    subtotal: null, totalCgst: null, totalSgst: null,
    totalIgst: null, grandTotal: null, notes: null,
    sku: null, productName: null, qty: null, unit: null,
    rate: null, discount: null, taxableValue: null,
    cgst: null, sgst: null, igst: null, lineTotal: null,
    ...o,
  }
}

describe('aggregateInvoiceRows — flat-rows mode', () => {
  it('groups 3 source rows with same invoiceNumber+date into 1 invoice with 3 lines', () => {
    const rows = [
      row({ sourceIndex: 0, invoiceNumber: 'INV-1', invoiceDate: '15/03/2025', partyName: 'Raju', productName: 'A', qty: '1', lineTotal: '100' }),
      row({ sourceIndex: 1, invoiceNumber: 'INV-1', invoiceDate: '15/03/2025', partyName: 'Raju', productName: 'B', qty: '2', lineTotal: '200' }),
      row({ sourceIndex: 2, invoiceNumber: 'INV-1', invoiceDate: '15/03/2025', partyName: 'Raju', productName: 'C', qty: '3', lineTotal: '300' }),
    ]
    const groups = aggregateInvoiceRows({ rows })
    expect(groups).toHaveLength(1)
    expect(groups[0]!.lines).toHaveLength(3)
    expect(groups[0]!.isoDate).toBe('2025-03-15')
    expect(groups[0]!.issues).toHaveLength(0)
  })

  it('emits HEADER_MISMATCH_WITHIN_INVOICE when partyName differs across lines', () => {
    const rows = [
      row({ sourceIndex: 0, invoiceNumber: 'INV-1', invoiceDate: '15/03/2025', partyName: 'Raju', productName: 'A' }),
      row({ sourceIndex: 1, invoiceNumber: 'INV-1', invoiceDate: '15/03/2025', partyName: 'Priya', productName: 'B' }),
    ]
    const groups = aggregateInvoiceRows({ rows })
    expect(groups).toHaveLength(1)
    const codes = groups[0]!.issues.map((i) => i.code)
    expect(codes).toContain('HEADER_MISMATCH_WITHIN_INVOICE')
  })

  it('only emits HEADER_MISMATCH once even if multiple lines disagree', () => {
    const rows = [
      row({ sourceIndex: 0, invoiceNumber: 'INV-1', invoiceDate: '15/03/2025', partyName: 'Raju' }),
      row({ sourceIndex: 1, invoiceNumber: 'INV-1', invoiceDate: '15/03/2025', partyName: 'Priya' }),
      row({ sourceIndex: 2, invoiceNumber: 'INV-1', invoiceDate: '15/03/2025', partyName: 'Amit' }),
    ]
    const groups = aggregateInvoiceRows({ rows })
    const mismatch = groups[0]!.issues.filter(
      (i) => i.code === 'HEADER_MISMATCH_WITHIN_INVOICE',
    )
    expect(mismatch).toHaveLength(1)
  })

  it('treats blank header on line 2+ as "matches" (Vyapar emits empties after line 1)', () => {
    const rows = [
      row({ sourceIndex: 0, invoiceNumber: 'INV-1', invoiceDate: '15/03/2025', partyName: 'Raju', grandTotal: '600' }),
      row({ sourceIndex: 1, invoiceNumber: 'INV-1', invoiceDate: '15/03/2025', partyName: null, grandTotal: null }),
    ]
    const groups = aggregateInvoiceRows({ rows })
    expect(groups[0]!.issues).toHaveLength(0)
  })

  it('sidelines row with missing invoice number → INVOICE_NUMBER_REQUIRED', () => {
    const rows = [
      row({ sourceIndex: 0, invoiceNumber: null, invoiceDate: '15/03/2025' }),
    ]
    const groups = aggregateInvoiceRows({ rows })
    expect(groups[0]!.issues[0]!.code).toBe('INVOICE_NUMBER_REQUIRED')
  })

  it('sidelines row with bad date → INVALID_DATE', () => {
    const rows = [
      row({ sourceIndex: 0, invoiceNumber: 'INV-1', invoiceDate: '03/15/2025' }),
    ]
    const groups = aggregateInvoiceRows({ rows })
    expect(groups[0]!.issues[0]!.code).toBe('INVALID_DATE')
  })

  it('emits LINES_PER_INVOICE_EXCEEDED and stops accumulation past cap', () => {
    const lines = Array.from({ length: LINES_PER_INVOICE_CAP + 5 }, (_, i) =>
      row({
        sourceIndex: i,
        invoiceNumber: 'INV-BIG',
        invoiceDate: '15/03/2025',
        partyName: 'Raju',
        productName: `P${i}`,
      }),
    )
    const groups = aggregateInvoiceRows({ rows: lines })
    expect(groups).toHaveLength(1)
    expect(groups[0]!.lines).toHaveLength(LINES_PER_INVOICE_CAP)
    expect(groups[0]!.issues.map((i) => i.code))
      .toContain('LINES_PER_INVOICE_EXCEEDED')
  })

  it('case-insensitive on invoice number key', () => {
    const rows = [
      row({ sourceIndex: 0, invoiceNumber: 'inv-1', invoiceDate: '15/03/2025', partyName: 'Raju' }),
      row({ sourceIndex: 1, invoiceNumber: 'INV-1', invoiceDate: '15/03/2025', partyName: 'Raju' }),
    ]
    const groups = aggregateInvoiceRows({ rows })
    expect(groups).toHaveLength(1)
    expect(groups[0]!.lines).toHaveLength(2)
  })
})

describe('aggregateInvoiceRows — pre-aggregated mode (Tally)', () => {
  it('passes through groups but parses date to ISO', () => {
    const groups = aggregateInvoiceRows({
      preAggregatedGroups: [{
        sourceIndex: 0,
        header: {
          invoiceNumber: 'V-1', invoiceDate: '15-Mar-2025',
          partyName: 'Raju', partyPhone: null, partyGstin: null,
          subtotal: null, totalCgst: null, totalSgst: null,
          totalIgst: null, grandTotal: null, notes: null,
        },
        lines: [{
          sku: 'A', productName: 'Widget', qty: '1', unit: 'pcs',
          rate: '100', discount: null, taxableValue: null,
          cgst: null, sgst: null, igst: null, lineTotal: '100',
        }],
      }],
    })
    expect(groups[0]!.isoDate).toBe('2025-03-15')
    expect(groups[0]!.lines).toHaveLength(1)
  })

  it('flags INVALID_DATE on bad Tally date', () => {
    const groups = aggregateInvoiceRows({
      preAggregatedGroups: [{
        sourceIndex: 0,
        header: {
          invoiceNumber: 'V-1', invoiceDate: 'garbage',
          partyName: null, partyPhone: null, partyGstin: null,
          subtotal: null, totalCgst: null, totalSgst: null,
          totalIgst: null, grandTotal: null, notes: null,
        },
        lines: [],
      }],
    })
    expect(groups[0]!.issues[0]!.code).toBe('INVALID_DATE')
  })
})
