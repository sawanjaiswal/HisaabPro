import { describe, it, expect } from 'vitest'
import { normalizeProductRow } from '../normalizers/product-normalizer.js'
import { TALLY_PRODUCT_MAPPING } from '../normalizers/product-mappings.js'

const mapping = TALLY_PRODUCT_MAPPING

function run(raw: Record<string, string>) {
  return normalizeProductRow({ sourceIndex: 0, raw }, mapping)
}

describe('Phase 7 · 7.1B — product normalizer', () => {
  it('happy path: full row → all fields populated as BigInt paise', () => {
    const r = run({
      name: 'Pen',
      sku: 'PEN-01',
      hsn: '96081019',
      unit: 'pcs',
      salePrice: '7.00',
      purchasePrice: '5.00',
      mrp: '10.00',
      openingStock: '12',
    })
    expect(r.name).toBe('Pen')
    expect(r.sku).toBe('PEN-01')
    expect(r.hsnCode).toBe('96081019')
    expect(r.unit).toBe('pcs')
    expect(r.salePrice).toBe(700n)
    expect(r.purchasePrice).toBe(500n)
    expect(r.mrp).toBe(1000n)
    expect(r.openingStock).toBe('12')
    expect(r.issues).toEqual([])
  })

  it('missing name → NAME_REQUIRED', () => {
    const r = run({ sku: 'X' })
    expect(r.issues.some((i) => i.code === 'NAME_REQUIRED')).toBe(true)
  })

  it('placeholder name → PRODUCT_PLACEHOLDER_NAME', () => {
    const r = run({ name: 'item 1' })
    expect(r.issues.some((i) => i.code === 'PRODUCT_PLACEHOLDER_NAME')).toBe(true)
  })

  it('price precision lost rounds and warns', () => {
    const r = run({ name: 'Pen', salePrice: '100.999' })
    expect(r.salePrice).toBe(10100n)
    expect(r.issues.some((i) => i.code === 'PRICE_PRECISION_LOST')).toBe(true)
  })

  it('unknown unit → unitSourceText preserved + UNIT_NOT_FOUND', () => {
    const r = run({ name: 'Pen', unit: 'wibble' })
    expect(r.unit).toBeUndefined()
    expect(r.unitSourceText).toBe('wibble')
    expect(r.issues.some((i) => i.code === 'UNIT_NOT_FOUND')).toBe(true)
  })

  it('garbage HSN → HSN_INVALID + hsnCode null', () => {
    const r = run({ name: 'Pen', hsn: 'ABC123' })
    expect(r.hsnCode).toBeNull()
    expect(r.issues.some((i) => i.code === 'HSN_INVALID')).toBe(true)
  })

  it('non-numeric openingStock → OPENING_STOCK_INVALID + 0', () => {
    const r = run({ name: 'Pen', openingStock: 'abc' })
    expect(r.openingStock).toBe('0')
    expect(r.issues.some((i) => i.code === 'OPENING_STOCK_INVALID')).toBe(true)
  })

  it('overlong description → DESCRIPTION_TRUNCATED', () => {
    const r = run({ name: 'Pen', description: 'x'.repeat(3000) })
    expect(r.issues.some((i) => i.code === 'DESCRIPTION_TRUNCATED')).toBe(true)
    expect((r.description ?? '').length).toBeLessThanOrEqual(2000)
  })

  it('zero-width injected name still stages cleanly', () => {
    const r = run({ name: 'Re​ynolds' })
    expect(r.name).toBe('Reynolds')
    expect(r.issues).toEqual([])
  })
})
