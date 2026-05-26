/**
 * Phase 7 · 7.1D PR-D2b — Tally Receipt-voucher parser tests.
 *
 * Coverage: happy + malicious (XXE re-test on Receipt branch) + edge
 * (M13 Tally 8-digit DATE, multi-allocation comma-join).
 */

import { describe, it, expect } from 'vitest'
import { tallyPaymentsParser } from '../parsers/tally-payments.parser.js'
import { ParseError } from '../parsers/parser.types.js'
import type { RawPaymentRow } from '../../../types/import.types.js'

const ctx = { format: 'TALLY_XML' as const, fileName: 'r.xml' }

function asRows(r: { rows: unknown }): RawPaymentRow[] {
  return r.rows as unknown as RawPaymentRow[]
}

describe('Phase 7 · 7.1D — Tally Receipt voucher parser', () => {
  it('happy — Receipt voucher with BILLALLOCATIONS + CHEQUENO', async () => {
    const xml = `<TALLY><VOUCHER VCHTYPE="Receipt" DATE="20250315">
      <PARTYLEDGERNAME>Raju Traders</PARTYLEDGERNAME>
      <PARTYMAILINGADDRESS.LIST>
        <PARTYMAILINGADDRESS>9876543210</PARTYMAILINGADDRESS>
      </PARTYMAILINGADDRESS.LIST>
      <CHEQUENO>CHQ-123456</CHEQUENO>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Bank A/c</LEDGERNAME>
        <AMOUNT>-50000.00</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Raju Traders</LEDGERNAME>
        <AMOUNT>50000.00</AMOUNT>
        <BILLALLOCATIONS.LIST>
          <NAME>INV-2025-007</NAME>
          <AMOUNT>50000.00</AMOUNT>
        </BILLALLOCATIONS.LIST>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER></TALLY>`
    const r = await tallyPaymentsParser(Buffer.from(xml), ctx)
    expect(r.rowCount).toBe(1)
    const row = asRows(r)[0]!
    expect(row.raw.partyName).toBe('Raju Traders')
    expect(row.raw.partyPhone).toBe('9876543210')
    expect(row.raw.amount).toBe('50000.00')
    expect(row.raw.mode).toBe('Bank A/c')
    expect(row.raw.referenceNumber).toBe('CHQ-123456')
    expect(row.raw.invoiceNumber).toBe('INV-2025-007')
    // M13: 20250315 must be pre-formatted to ISO before downstream
    expect(row.raw.date).toBe('2025-03-15')
  })

  it('malicious — XXE re-test: DOCTYPE/ENTITY rejected on Receipt branch', async () => {
    const xml = `<?xml version="1.0"?>
      <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
      <TALLY><VOUCHER VCHTYPE="Receipt" DATE="20250315">
        <PARTYLEDGERNAME>&xxe;</PARTYLEDGERNAME>
      </VOUCHER></TALLY>`
    await expect(tallyPaymentsParser(Buffer.from(xml), ctx)).rejects.toBeInstanceOf(
      ParseError,
    )
  })

  it('edge — 8-digit Tally date with invalid calendar drops the date field', async () => {
    // Feb 30 — never valid; tallyPreformatDate returns null → empty
    const xml = `<TALLY><VOUCHER VCHTYPE="Receipt" DATE="20250230">
      <PARTYLEDGERNAME>X</PARTYLEDGERNAME>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Cash</LEDGERNAME>
        <AMOUNT>-100.00</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER></TALLY>`
    const r = await tallyPaymentsParser(Buffer.from(xml), ctx)
    expect(r.rowCount).toBe(1)
    const row = asRows(r)[0]!
    expect(row.raw.date).toBeUndefined() // normalizer raises INVALID_DATE
  })

  it('edge — multi BILLALLOCATIONS comma-joined for normalizer to reject', async () => {
    const xml = `<TALLY><VOUCHER VCHTYPE="Receipt" DATE="20250315">
      <PARTYLEDGERNAME>P</PARTYLEDGERNAME>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Bank</LEDGERNAME>
        <AMOUNT>-500.00</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>P</LEDGERNAME>
        <AMOUNT>500.00</AMOUNT>
        <BILLALLOCATIONS.LIST>
          <NAME>INV-1</NAME>
        </BILLALLOCATIONS.LIST>
        <BILLALLOCATIONS.LIST>
          <NAME>INV-2</NAME>
        </BILLALLOCATIONS.LIST>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER></TALLY>`
    const r = await tallyPaymentsParser(Buffer.from(xml), ctx)
    expect(r.rowCount).toBe(1)
    expect(asRows(r)[0]!.raw.invoiceNumber).toBe('INV-1,INV-2')
  })

  it('drops non-Receipt vouchers (e.g. VCHTYPE="Sales")', async () => {
    const xml = `<TALLY><VOUCHER VCHTYPE="Sales" DATE="20250315">
      <PARTYLEDGERNAME>X</PARTYLEDGERNAME>
    </VOUCHER></TALLY>`
    const r = await tallyPaymentsParser(Buffer.from(xml), ctx)
    expect(r.rowCount).toBe(0)
  })

  it('empty buffer → EMPTY_FILE', async () => {
    await expect(
      tallyPaymentsParser(Buffer.alloc(0), ctx),
    ).rejects.toBeInstanceOf(ParseError)
  })
})
