/**
 * Phase 7 · 7.1D PR-D2b — Generic payments CSV parser tests.
 *
 * Coverage: happy (auto-detected canonical) + zero-mapping fallback +
 * malicious (CSV-injection-shaped header passes through, sanitisation
 * downstream) + edge.
 */

import { describe, it, expect } from 'vitest'
import { genericPaymentsParser } from '../parsers/generic-payments.parser.js'
import { ParseError } from '../parsers/parser.types.js'
import type { RawPaymentRow } from '../../../types/import.types.js'

const ctx = { format: 'GENERIC_CSV' as const, fileName: 'g.csv' }

function asRows(r: { rows: unknown }): RawPaymentRow[] {
  return r.rows as unknown as RawPaymentRow[]
}

describe('Phase 7 · 7.1D — Generic payments CSV parser', () => {
  it('happy — alias auto-detect maps canonical fields', async () => {
    const csv =
      'Txn Date,Customer Name,Mobile,Received,Mode,Ref,Bill No\n' +
      '2025-03-15,Priya,9876543210,250,UPI,UPI-1,INV-2\n'
    const r = await genericPaymentsParser(Buffer.from(csv), ctx)
    expect(r.rowCount).toBe(1)
    const row = asRows(r)[0]!
    expect(row.raw.date).toBe('2025-03-15')
    expect(row.raw.partyName).toBe('Priya')
    expect(row.raw.partyPhone).toBe('9876543210')
    expect(row.raw.amount).toBe('250')
    expect(row.raw.mode).toBe('UPI')
    expect(row.raw.referenceNumber).toBe('UPI-1')
    expect(row.raw.invoiceNumber).toBe('INV-2')
  })

  it('edge — zero canonical mapping falls back to verbatim headers', async () => {
    // Headers that don't match any alias — parser should still emit
    // rows so the FE column mapper can surface them. Normalizer raises
    // MAPPING_REQUIRED later.
    const csv = 'foo,bar\nx,y\n'
    const r = await genericPaymentsParser(Buffer.from(csv), ctx)
    expect(r.rowCount).toBe(1)
    const row = asRows(r)[0]!
    expect(row.raw.foo).toBe('x')
    expect(row.raw.bar).toBe('y')
    expect(row.raw.date).toBeUndefined()
  })

  it('malicious — CSV-injection-shaped value passes through (sanitisation is downstream)', async () => {
    // Per ARCH §4: parsers shuttle strings; normalizer sanitises.
    const csv = 'Date,Notes\n2025-03-15,=cmd|"calc"\n'
    const r = await genericPaymentsParser(Buffer.from(csv), ctx)
    expect(r.rowCount).toBe(1)
    const row = asRows(r)[0]!
    expect(row.raw.date).toBe('2025-03-15')
    expect(row.raw.notes).toBe('=cmd|"calc"') // unchanged at this layer
  })

  it('edge — partial mapping (only date+amount detected)', async () => {
    const csv = 'Date,Amount,Custom\n2025-03-15,100,zzz\n'
    const r = await genericPaymentsParser(Buffer.from(csv), ctx)
    const row = asRows(r)[0]!
    expect(row.raw.date).toBe('2025-03-15')
    expect(row.raw.amount).toBe('100')
    // Custom header not in dict → not surfaced (would require MAPPING)
    expect(row.raw.Custom).toBeUndefined()
  })

  it('empty buffer → EMPTY_FILE', async () => {
    await expect(
      genericPaymentsParser(Buffer.alloc(0), ctx),
    ).rejects.toBeInstanceOf(ParseError)
  })
})
