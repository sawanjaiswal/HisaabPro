import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { busyXlsxParser } from '../busy-xlsx.parser.js'

const ctx = { format: 'BUSY_XLSX' as const }

function buildBusyXlsx(rows: Array<Record<string, string | number>>): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      'PartyName',
      'PhoneNo',
      'MobileNo',
      'EmailID',
      'GSTIN',
      'Address1',
      'Address2',
      'Opening Balance',
      'Dr/Cr',
    ],
  })
  XLSX.utils.book_append_sheet(wb, ws, 'Parties')
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.from(out as ArrayBuffer)
}

describe('busyXlsxParser', () => {
  it('parses a happy-path xlsx', async () => {
    const buffer = buildBusyXlsx([
      {
        PartyName: 'Raju Traders',
        PhoneNo: '9111111111',
        MobileNo: '9000000000',
        EmailID: 'raju@x.com',
        GSTIN: '27ABCDE1234F1Z5',
        Address1: '12 MG Rd',
        Address2: 'Andheri',
        'Opening Balance': 1500,
        'Dr/Cr': 'Dr',
      },
      {
        PartyName: 'ACME',
        PhoneNo: '',
        MobileNo: '9222222222',
        EmailID: '',
        GSTIN: '',
        Address1: 'Bandra',
        Address2: '',
        'Opening Balance': 0,
        'Dr/Cr': 'Cr',
      },
    ])
    const res = await busyXlsxParser(buffer, ctx)
    expect(res.rowCount).toBe(2)
    expect(res.rows[0]!.raw.name).toBe('Raju Traders')
    expect(res.rows[0]!.raw.phone).toBe('9111111111')
    expect(res.rows[0]!.raw.address).toBe('12 MG Rd, Andheri')
    // mobile fallback
    expect(res.rows[1]!.raw.phone).toBe('9222222222')
    expect(res.rows[1]!.raw.address).toBe('Bandra')
  })

  it('rejects empty buffer', async () => {
    await expect(busyXlsxParser(Buffer.alloc(0), ctx)).rejects.toMatchObject({
      code: 'EMPTY_FILE',
    })
  })

  it('rejects a non-zip buffer (UNSAFE_ARCHIVE)', async () => {
    const junk = Buffer.from('not a zip file at all', 'utf8')
    await expect(busyXlsxParser(junk, ctx)).rejects.toMatchObject({
      code: 'UNSAFE_ARCHIVE',
    })
  })

  it('skips rows without a party name', async () => {
    const buffer = buildBusyXlsx([
      {
        PartyName: '',
        PhoneNo: '9111111111',
        MobileNo: '',
        EmailID: '',
        GSTIN: '',
        Address1: '',
        Address2: '',
        'Opening Balance': 0,
        'Dr/Cr': 'Dr',
      },
      {
        PartyName: 'Real Party',
        PhoneNo: '9222222222',
        MobileNo: '',
        EmailID: '',
        GSTIN: '',
        Address1: '',
        Address2: '',
        'Opening Balance': 0,
        'Dr/Cr': 'Dr',
      },
    ])
    const res = await busyXlsxParser(buffer, ctx)
    expect(res.rowCount).toBe(1)
    expect(res.rows[0]!.raw.name).toBe('Real Party')
  })
})
