import { describe, it, expect } from 'vitest'
import { vyaparCsvParser } from '../vyapar-csv.parser.js'

const ctx = { format: 'VYAPAR_CSV' as const }

const HEADER =
  'Party Name,Phone Number,Email,GSTIN,Address,Opening Balance,Type'

describe('vyaparCsvParser', () => {
  it('parses a 3-row export', async () => {
    const csv =
      `${HEADER}\n` +
      `Raju Traders,9111111111,raju@x.com,27ABCDE1234F1Z5,MG Rd,1500,Customer\n` +
      `ACME Wholesale,9222222222,acme@x.com,,Andheri,0,Supplier\n` +
      `Vendor Co,9333333333,,,,500,Both\n`
    const res = await vyaparCsvParser(Buffer.from(csv, 'utf8'), ctx)
    expect(res.rowCount).toBe(3)
    expect(res.rows[0]!.raw.name).toBe('Raju Traders')
    expect(res.rows[0]!.raw.type).toBe('Customer')
    expect(res.rows[1]!.raw.type).toBe('Supplier')
    expect(res.rows[2]!.raw.type).toBe('Both')
  })

  it('strips a UTF-8 BOM from the first header', async () => {
    const csv =
      `﻿${HEADER}\n` +
      `Raju,9111111111,,,,,Customer\n`
    const res = await vyaparCsvParser(Buffer.from(csv, 'utf8'), ctx)
    expect(res.rowCount).toBe(1)
    expect(res.rows[0]!.raw.name).toBe('Raju')
  })

  it('handles CRLF line endings', async () => {
    const csv = `${HEADER}\r\nRaju,9111111111,,,,,Customer\r\n`
    const res = await vyaparCsvParser(Buffer.from(csv, 'utf8'), ctx)
    expect(res.rowCount).toBe(1)
  })

  it('returns empty result for header-only CSV', async () => {
    const csv = `${HEADER}\n`
    const res = await vyaparCsvParser(Buffer.from(csv, 'utf8'), ctx)
    expect(res.rowCount).toBe(0)
  })

  it('rejects empty buffer', async () => {
    await expect(vyaparCsvParser(Buffer.alloc(0), ctx)).rejects.toMatchObject({
      code: 'EMPTY_FILE',
    })
  })

  it('drops rows with unrecognised Type values', async () => {
    const csv =
      `${HEADER}\n` +
      `Raju,9111111111,,,,,Customer\n` +
      `Vendor,9222222222,,,,,Random\n`
    const res = await vyaparCsvParser(Buffer.from(csv, 'utf8'), ctx)
    expect(res.rowCount).toBe(1)
    expect(res.rows[0]!.raw.name).toBe('Raju')
  })
})
