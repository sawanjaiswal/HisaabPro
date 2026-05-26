/**
 * Phase 7 · 7.1D PR-D2b — Vyapar payments CSV parser tests.
 *
 * Coverage: happy + header-alias variations (EN + Devanagari) +
 * malicious (prototype-pollution header) + edge (BOM).
 */

import { describe, it, expect } from 'vitest'
import { vyaparPaymentsParser } from '../parsers/vyapar-payments.parser.js'
import { ParseError } from '../parsers/parser.types.js'
import type { RawPaymentRow } from '../../../types/import.types.js'

const ctx = { format: 'VYAPAR_CSV' as const, fileName: 'p.csv' }

function asRows(r: { rows: unknown }): RawPaymentRow[] {
  return r.rows as unknown as RawPaymentRow[]
}

describe('Phase 7 · 7.1D — Vyapar payments CSV parser', () => {
  it('happy — canonical Vyapar headers', async () => {
    const csv =
      'Date,Party Name,Phone,Amount,Payment Mode,Reference No,Invoice No,Notes\n' +
      '2025-03-15,Raju Traders,9876543210,50000,UPI,UPI-REF-9,INV-007,Advance\n'
    const r = await vyaparPaymentsParser(Buffer.from(csv), ctx)
    expect(r.rowCount).toBe(1)
    const row = asRows(r)[0]!
    expect(row.raw.date).toBe('2025-03-15')
    expect(row.raw.partyName).toBe('Raju Traders')
    expect(row.raw.partyPhone).toBe('9876543210')
    expect(row.raw.amount).toBe('50000')
    expect(row.raw.mode).toBe('UPI')
    expect(row.raw.referenceNumber).toBe('UPI-REF-9')
    expect(row.raw.invoiceNumber).toBe('INV-007')
    expect(row.raw.notes).toBe('Advance')
  })

  it('edge — Devanagari header aliases map to canonical keys', async () => {
    const csv =
      'दिनांक,पार्टी,मोबाइल,राशि,भुगतान प्रकार\n' +
      '2025-03-15,राजू,9876543210,1500,नकद\n'
    const r = await vyaparPaymentsParser(Buffer.from(csv), ctx)
    expect(r.rowCount).toBe(1)
    const row = asRows(r)[0]!
    expect(row.raw.date).toBe('2025-03-15')
    expect(row.raw.partyName).toBe('राजू')
    expect(row.raw.partyPhone).toBe('9876543210')
    expect(row.raw.amount).toBe('1500')
    expect(row.raw.mode).toBe('नकद')
  })

  it('edge — alternate aliases (Customer/UTR/Bill No)', async () => {
    const csv =
      'Receipt Date,Customer,Received,Mode,UTR,Bill No\n' +
      '2025-03-15,Priya,250,NEFT,UTR12345,INV-2\n'
    const r = await vyaparPaymentsParser(Buffer.from(csv), ctx)
    const row = asRows(r)[0]!
    expect(row.raw.date).toBe('2025-03-15')
    expect(row.raw.partyName).toBe('Priya')
    expect(row.raw.amount).toBe('250')
    expect(row.raw.mode).toBe('NEFT')
    expect(row.raw.referenceNumber).toBe('UTR12345')
    expect(row.raw.invoiceNumber).toBe('INV-2')
  })

  it('malicious — header named __proto__ does not poison output', async () => {
    // The Map-based resolver returns null for any unknown header
    // including __proto__ / constructor — column is silently dropped.
    const csv = '__proto__,Amount\nbad,100\n'
    const r = await vyaparPaymentsParser(Buffer.from(csv), ctx)
    const row = asRows(r)[0]!
    expect(row.raw.amount).toBe('100')
    // No canonical key was emitted for __proto__; the row carries only amount.
    expect(row.raw).not.toHaveProperty('__proto__')
    expect(Object.getPrototypeOf(row.raw)).toBe(Object.prototype)
  })

  it('edge — BOM on first header is stripped', async () => {
    const csv = '﻿Date,Amount\n2025-03-15,500\n'
    const r = await vyaparPaymentsParser(Buffer.from(csv), ctx)
    const row = asRows(r)[0]!
    expect(row.raw.date).toBe('2025-03-15')
    expect(row.raw.amount).toBe('500')
  })

  it('empty buffer → EMPTY_FILE', async () => {
    await expect(
      vyaparPaymentsParser(Buffer.alloc(0), ctx),
    ).rejects.toBeInstanceOf(ParseError)
  })
})
