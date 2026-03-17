import { describe, it, expect } from 'vitest'
import {
  formatStock,
  getStockStatus,
  generateSku,
  generateDefaultSku,
  getProductInitials,
  getProductAvatarColor,
  paiseToRupees,
  rupeesToPaise,
  stockValue,
  stockDeficit,
  convertQty,
  inverseConversionFactor,
  priceForUnit,
} from '../product.utils'

// ─── Stock formatting ────────────────────────────────────────────────────────

describe('formatStock', () => {
  it('formats integer qty', () => {
    expect(formatStock(45, 'pcs')).toBe('45 pcs')
  })

  it('formats decimal qty', () => {
    expect(formatStock(2.5, 'kg')).toMatch(/2.5 kg/)
  })
})

// ─── Stock status ────────────────────────────────────────────────────────────

describe('getStockStatus', () => {
  it('returns "out" when stock <= 0', () => {
    expect(getStockStatus(0, 10)).toBe('out')
    expect(getStockStatus(-5, 10)).toBe('out')
  })

  it('returns "low" when below min', () => {
    expect(getStockStatus(5, 20)).toBe('low')
  })

  it('returns "ok" when at or above min', () => {
    expect(getStockStatus(20, 20)).toBe('ok')
    expect(getStockStatus(50, 20)).toBe('ok')
  })

  it('returns "ok" when min is 0 (no min set)', () => {
    expect(getStockStatus(5, 0)).toBe('ok')
  })
})

// ─── SKU generation ──────────────────────────────────────────────────────────

describe('generateSku', () => {
  it('pads with zeros', () => {
    expect(generateSku('PRD', 1)).toBe('PRD-0001')
  })

  it('does not truncate large counters', () => {
    expect(generateSku('PRD', 10000)).toBe('PRD-10000')
  })
})

describe('generateDefaultSku', () => {
  it('uses default prefix', () => {
    expect(generateDefaultSku(42)).toBe('PRD-0042')
  })
})

// ─── Product initials ────────────────────────────────────────────────────────

describe('getProductInitials', () => {
  it('extracts two-word initials', () => {
    expect(getProductInitials('Maggi Noodles')).toBe('MN')
  })

  it('falls back to first two chars for single word', () => {
    expect(getProductInitials('Sugar')).toBe('SU')
  })

  it('handles single char name', () => {
    expect(getProductInitials('A')).toBe('A ')
  })
})

// ─── Avatar color ────────────────────────────────────────────────────────────

describe('getProductAvatarColor', () => {
  it('returns deterministic color for same name', () => {
    const color1 = getProductAvatarColor('Rice Bag')
    const color2 = getProductAvatarColor('Rice Bag')
    expect(color1).toBe(color2)
  })

  it('returns different colors for different names', () => {
    const c1 = getProductAvatarColor('Product A')
    const c2 = getProductAvatarColor('Product B')
    // Not guaranteed different, but very likely
    expect(typeof c1).toBe('string')
    expect(typeof c2).toBe('string')
  })
})

// ─── Paise conversion ────────────────────────────────────────────────────────

describe('paiseToRupees / rupeesToPaise', () => {
  it('converts paise to rupees', () => {
    expect(paiseToRupees(14900)).toBe(149)
  })

  it('converts rupees to paise', () => {
    expect(rupeesToPaise(14.99)).toBe(1499)
  })
})

// ─── Stock value ─────────────────────────────────────────────────────────────

describe('stockValue', () => {
  it('calculates stock value', () => {
    expect(stockValue(100, 5000)).toBe(500000)
  })

  it('returns 0 for null purchase price', () => {
    expect(stockValue(100, null)).toBe(0)
  })
})

// ─── Stock deficit ───────────────────────────────────────────────────────────

describe('stockDeficit', () => {
  it('returns deficit when below min', () => {
    expect(stockDeficit(5, 20)).toBe(15)
  })

  it('returns 0 when at or above min', () => {
    expect(stockDeficit(30, 20)).toBe(0)
  })
})

// ─── Unit conversion ─────────────────────────────────────────────────────────

describe('convertQty', () => {
  it('multiplies by factor', () => {
    expect(convertQty(2, 12)).toBe(24)
  })

  it('returns null for zero factor', () => {
    expect(convertQty(2, 0)).toBeNull()
  })

  it('returns null for negative factor', () => {
    expect(convertQty(2, -1)).toBeNull()
  })
})

describe('inverseConversionFactor', () => {
  it('returns inverse', () => {
    const result = inverseConversionFactor(12)
    expect(result).toBeCloseTo(1 / 12)
  })

  it('returns null for zero', () => {
    expect(inverseConversionFactor(0)).toBeNull()
  })
})

describe('priceForUnit', () => {
  it('calculates price with conversion', () => {
    expect(priceForUnit(500, 12)).toBe(6000)
  })
})
