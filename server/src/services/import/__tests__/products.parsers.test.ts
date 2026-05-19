import { describe, it, expect } from 'vitest'
import { tallyProductsParser } from '../parsers/tally-products.parser.js'
import { vyaparProductsParser } from '../parsers/vyapar-products.parser.js'
import { genericProductsParser } from '../parsers/generic-products.parser.js'
import { ParseError } from '../parsers/parser.types.js'

const ctx = { format: 'TALLY_XML' as const, fileName: 'p.xml' }

describe('Phase 7 · 7.1B — product parsers (happy paths)', () => {
  it('tally STOCKITEM → RawProductRow', async () => {
    const xml = `<TALLY><STOCKITEM NAME="Pen">
      <ALIAS>PEN-01</ALIAS>
      <HSNCODE>96081019</HSNCODE>
      <BASEUNITS>pcs</BASEUNITS>
      <OPENINGBALANCE>10</OPENINGBALANCE>
      <OPENINGRATE>5.00</OPENINGRATE>
      <STANDARDPRICE>7.00</STANDARDPRICE>
      <MRP>10.00</MRP>
    </STOCKITEM></TALLY>`
    const r = await tallyProductsParser(Buffer.from(xml), ctx)
    expect(r.rowCount).toBe(1)
    const row = (r.rows as unknown as Array<{ raw: Record<string, string> }>)[0]!
    expect(row.raw.name).toBe('Pen')
    expect(row.raw.sku).toBe('PEN-01')
    expect(row.raw.hsn).toBe('96081019')
    expect(row.raw.unit).toBe('pcs')
    expect(row.raw.salePrice).toBe('7.00')
    expect(row.raw.purchasePrice).toBe('5.00')
    expect(row.raw.mrp).toBe('10.00')
    expect(row.raw.openingStock).toBe('10')
  })

  it('vyapar items CSV → RawProductRow', async () => {
    const csv =
      'Item Name,Item Code,HSN,Unit,Sale Price,Purchase Price,MRP,Opening Stock\n' +
      'Pen,PEN-01,96081019,pcs,7,5,10,12\n'
    const r = await vyaparProductsParser(Buffer.from(csv), { format: 'VYAPAR_CSV' })
    expect(r.rowCount).toBe(1)
    const row = (r.rows as unknown as Array<{ raw: Record<string, string> }>)[0]!
    expect(row.raw.name).toBe('Pen')
    expect(row.raw.salePrice).toBe('7')
    expect(row.raw.openingStock).toBe('12')
  })

  it('generic CSV passes header keys through verbatim', async () => {
    const csv = 'product name,price\nPen,7\n'
    const r = await genericProductsParser(Buffer.from(csv), { format: 'GENERIC_CSV' })
    expect(r.rowCount).toBe(1)
    const row = (r.rows as unknown as Array<{ raw: Record<string, string> }>)[0]!
    expect(row.raw['product name']).toBe('Pen')
    expect(row.raw['price']).toBe('7')
  })
})

describe('Phase 7 · 7.1B — product parsers (malicious / edge)', () => {
  it('tally rejects empty buffer with EMPTY_FILE', async () => {
    await expect(tallyProductsParser(Buffer.alloc(0), ctx)).rejects.toBeInstanceOf(
      ParseError,
    )
  })

  it('tally with unmatched STOCKITEM tag yields 0 rows (no crash)', async () => {
    const r = await tallyProductsParser(
      Buffer.from('<TALLY><STOCKITEM></TALLY>'),
      ctx,
    )
    expect(r.rowCount).toBe(0)
  })

  it('vyapar CSV with BOM strips it from header', async () => {
    const csv = '﻿Item Name,Sale Price\nPen,7\n'
    const r = await vyaparProductsParser(Buffer.from(csv), { format: 'VYAPAR_CSV' })
    expect(r.rowCount).toBe(1)
  })

  it('generic CSV with empty header skips that column', async () => {
    const csv = 'name,,price\nPen,,7\n'
    const r = await genericProductsParser(Buffer.from(csv), { format: 'GENERIC_CSV' })
    expect(r.rowCount).toBe(1)
    const row = (r.rows as unknown as Array<{ raw: Record<string, string> }>)[0]!
    expect(row.raw['name']).toBe('Pen')
    expect(row.raw['price']).toBe('7')
  })

  it('tally drops STOCKITEM without NAME', async () => {
    const xml = `<TALLY><STOCKITEM><ALIAS>X</ALIAS></STOCKITEM></TALLY>`
    const r = await tallyProductsParser(Buffer.from(xml), ctx)
    expect(r.rowCount).toBe(0)
  })
})
