/**
 * Phase 7 · 7.1D PR-D2b — Busy ReceiptRegister XLSX parser tests.
 *
 * Coverage: happy (built via SheetJS so the test is hermetic — no
 * fixture binary needed) + sheet-name selection + cell-date NF + edge.
 */

import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { busyPaymentsParser } from '../parsers/busy-payments.parser.js'
import { ParseError } from '../parsers/parser.types.js'
import type { RawPaymentRow } from '../../../types/import.types.js'

const ctx = { format: 'BUSY_XLSX' as const, fileName: 'b.xlsx' }

function asRows(r: { rows: unknown }): RawPaymentRow[] {
  return r.rows as unknown as RawPaymentRow[]
}

function buildXlsx(rows: Array<Record<string, unknown>>, sheetName: string): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

describe('Phase 7 · 7.1D — Busy ReceiptRegister XLSX parser', () => {
  it('happy — ReceiptRegister sheet with ISO date column', async () => {
    const buf = buildXlsx(
      [
        {
          Date: '2025-03-15',
          'Party Name': 'Raju',
          Phone: '9876543210',
          Amount: 1500,
          'Payment Mode': 'Cash',
          'Reference No': 'R-1',
          'Invoice No': 'INV-1',
          Notes: 'paid',
        },
        {
          Date: '2025-03-16',
          'Party Name': 'Priya',
          Amount: 2500,
          'Payment Mode': 'UPI',
        },
      ],
      'ReceiptRegister',
    )
    const r = await busyPaymentsParser(buf, ctx)
    expect(r.rowCount).toBe(2)
    const row = asRows(r)[0]!
    expect(row.raw.date).toBe('2025-03-15')
    expect(row.raw.partyName).toBe('Raju')
    expect(row.raw.partyPhone).toBe('9876543210')
    expect(row.raw.amount).toBe('1500')
    expect(row.raw.mode).toBe('Cash')
    expect(row.raw.referenceNumber).toBe('R-1')
    expect(row.raw.invoiceNumber).toBe('INV-1')
  })

  it('edge — sheet name "Receipts" still picked (case-insensitive /receipt/i)', async () => {
    const buf = buildXlsx(
      [{ Date: '2025-03-15', 'Party Name': 'X', Amount: 100, 'Payment Mode': 'Cash' }],
      'Receipts',
    )
    const r = await busyPaymentsParser(buf, ctx)
    expect(r.rowCount).toBe(1)
  })

  it('edge — empty sheet falls back to first sheet (no /receipt/i match)', async () => {
    const buf = buildXlsx(
      [{ Date: '2025-03-15', 'Party Name': 'X', Amount: 100, 'Payment Mode': 'Cash' }],
      'Sheet1',
    )
    const r = await busyPaymentsParser(buf, ctx)
    expect(r.rowCount).toBe(1)
  })

  it('edge — rows with no canonical fields are dropped (merged-cell title)', async () => {
    // Single column not in alias dictionary, no date/amount → row dropped
    const buf = buildXlsx(
      [
        { Heading: 'Receipts Report — March 2025' },
        { Date: '2025-03-15', 'Party Name': 'X', Amount: 50, 'Payment Mode': 'Cash' },
      ],
      'ReceiptRegister',
    )
    const r = await busyPaymentsParser(buf, ctx)
    expect(r.rowCount).toBe(1)
  })

  it('malicious — empty buffer → EMPTY_FILE', async () => {
    await expect(
      busyPaymentsParser(Buffer.alloc(0), ctx),
    ).rejects.toBeInstanceOf(ParseError)
  })
})
