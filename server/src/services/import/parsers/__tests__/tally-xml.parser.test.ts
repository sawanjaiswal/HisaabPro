import { describe, it, expect } from 'vitest'
import { tallyXmlParser } from '../tally-xml.parser.js'
import { ParseError } from '../parser.types.js'

const ctx = { format: 'TALLY_XML' as const }

const happy = `<?xml version="1.0"?>
<ENVELOPE><BODY><IMPORTDATA><REQUESTDATA>
  <TALLYMESSAGE>
    <LEDGER NAME="Raju Traders">
      <PARENT>Sundry Debtors</PARENT>
      <LEDPHONE>9111111111</LEDPHONE>
      <EMAIL>raju@example.com</EMAIL>
      <GSTREGNUMBER>27ABCDE1234F1Z5</GSTREGNUMBER>
      <LEDMAILINGADDRESS>123 MG Road</LEDMAILINGADDRESS>
      <OPENINGBALANCE>1500.00</OPENINGBALANCE>
    </LEDGER>
  </TALLYMESSAGE>
  <TALLYMESSAGE>
    <LEDGER NAME="ACME Wholesale">
      <PARENT>Sundry Creditors</PARENT>
      <PHONE>9222222222</PHONE>
    </LEDGER>
  </TALLYMESSAGE>
  <TALLYMESSAGE>
    <LEDGER NAME="Cash">
      <PARENT>Cash-in-Hand</PARENT>
    </LEDGER>
  </TALLYMESSAGE>
</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`

describe('tallyXmlParser', () => {
  it('extracts party ledgers and skips non-party PARENT', async () => {
    const res = await tallyXmlParser(Buffer.from(happy, 'utf8'), ctx)
    expect(res.rowCount).toBe(2)
    expect(res.rows[0]!.raw.name).toBe('Raju Traders')
    expect(res.rows[0]!.raw.phone).toBe('9111111111')
    expect(res.rows[0]!.raw.email).toBe('raju@example.com')
    expect(res.rows[0]!.raw.gstin).toBe('27ABCDE1234F1Z5')
    expect(res.rows[0]!.raw.address).toBe('123 MG Road')
    expect(res.rows[0]!.raw.openingBalance).toBe('1500.00')
    expect(res.rows[1]!.raw.name).toBe('ACME Wholesale')
    expect(res.rows[1]!.raw.phone).toBe('9222222222')
  })

  it('rejects XML with DOCTYPE via XXE pre-scan', async () => {
    const evil = `<?xml version="1.0"?><!DOCTYPE foo><ENVELOPE/>`
    await expect(
      tallyXmlParser(Buffer.from(evil, 'utf8'), ctx),
    ).rejects.toMatchObject({ code: 'UNSAFE_XML' })
  })

  it('rejects empty buffer', async () => {
    await expect(tallyXmlParser(Buffer.alloc(0), ctx)).rejects.toMatchObject({
      code: 'EMPTY_FILE',
    })
  })

  it('rejects malformed XML', async () => {
    const bad = `<ENVELOPE><BROKEN`
    await expect(
      tallyXmlParser(Buffer.from(bad, 'utf8'), ctx),
    ).rejects.toBeInstanceOf(ParseError)
  })

  it('returns empty rows when no LEDGER nodes', async () => {
    const empty = `<?xml version="1.0"?><ENVELOPE/>`
    const res = await tallyXmlParser(Buffer.from(empty, 'utf8'), ctx)
    expect(res.rowCount).toBe(0)
  })
})
