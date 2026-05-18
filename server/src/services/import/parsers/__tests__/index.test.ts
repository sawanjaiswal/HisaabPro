import { describe, it, expect } from 'vitest'
import { parseFile, ParseError } from '../index.js'

describe('parsers dispatcher', () => {
  it('routes TALLY_XML to the xml parser', async () => {
    const xml = `<?xml version="1.0"?>
<ENVELOPE><BODY><LEDGER NAME="Raju"><PARENT>Sundry Debtors</PARENT></LEDGER></BODY></ENVELOPE>`
    const res = await parseFile(Buffer.from(xml, 'utf8'), {
      format: 'TALLY_XML',
    })
    expect(res.rowCount).toBe(1)
    expect(res.rows[0]!.raw.name).toBe('Raju')
  })

  it('routes VYAPAR_CSV to the vyapar parser', async () => {
    const csv =
      'Party Name,Phone Number,Email,GSTIN,Address,Opening Balance,Type\n' +
      'Raju,9111111111,,,,,Customer\n'
    const res = await parseFile(Buffer.from(csv, 'utf8'), {
      format: 'VYAPAR_CSV',
    })
    expect(res.rowCount).toBe(1)
  })

  it('routes GENERIC_CSV to the generic parser', async () => {
    const csv = 'Foo,Bar\nx,y\n'
    const res = await parseFile(Buffer.from(csv, 'utf8'), {
      format: 'GENERIC_CSV',
    })
    expect(res.rowCount).toBe(1)
    expect(res.rows[0]!.raw.Foo).toBe('x')
  })

  it('throws UNSUPPORTED_FORMAT for an unknown format', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parseFile(Buffer.from('x', 'utf8'), { format: 'XYZ' as any }),
    ).rejects.toBeInstanceOf(ParseError)
  })
})
