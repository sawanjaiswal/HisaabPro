import { describe, it, expect } from 'vitest'
import {
  bigintReplacer,
  serializeNormalizedProduct,
} from '../../../utils/json-bigint.js'
import type { NormalizedProduct } from '../../../types/import.types.js'

describe('M5 — BigInt JSON serialisation', () => {
  it('bigintReplacer converts BigInt to string', () => {
    const out = JSON.stringify({ a: 12345n, b: 'hi' }, bigintReplacer)
    expect(out).toBe('{"a":"12345","b":"hi"}')
  })

  it('serializeNormalizedProduct emits price strings', () => {
    const p: NormalizedProduct = {
      name: 'Pen',
      sku: 'PEN-01',
      salePrice: 10050n,
      purchasePrice: 7500n,
      mrp: 12000n,
      unit: 'pcs',
      openingStock: '10',
      issues: [],
    }
    const out = serializeNormalizedProduct(p)
    expect(out.salePrice).toBe('10050')
    expect(out.purchasePrice).toBe('7500')
    expect(out.mrp).toBe('12000')
    expect(out.openingStock).toBe('10')
    expect(JSON.stringify(out)).not.toContain('NaN')
  })

  it('does NOT install global BigInt.prototype.toJSON', () => {
    // Confirms we never poisoned the global. JSON.stringify on a raw
    // BigInt must still throw without our replacer.
    expect(() => JSON.stringify(123n)).toThrow(TypeError)
  })
})
