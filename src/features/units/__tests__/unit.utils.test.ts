import { describe, it, expect } from 'vitest'
import {
  getUnitCategory,
  groupUnitsByCategory,
  formatUnitDisplay,
  validateUnitName,
  validateUnitSymbol,
} from '../unit.utils'
import type { Unit, UnitCategory } from '../unit.types'

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'u1',
    name: 'kilogram',
    symbol: 'kg',
    type: 'PREDEFINED',
    category: 'OTHER' as UnitCategory,
    decimalAllowed: true,
    baseUnitId: null,
    baseUnitFactor: null,
    baseUnit: null,
    productCount: 0,
    ...overrides,
  } as Unit
}

// ─── getUnitCategory ──────────────────────────────────────────────────────────

describe('getUnitCategory', () => {
  it('returns API category when present', () => {
    expect(getUnitCategory(makeUnit({ category: 'VOLUME' }))).toBe('VOLUME')
  })

  it('infers category from symbol for predefined units', () => {
    expect(getUnitCategory(makeUnit({ symbol: 'kg', category: null as unknown as UnitCategory }))).toBe('WEIGHT')
    expect(getUnitCategory(makeUnit({ symbol: 'ltr', category: null as unknown as UnitCategory }))).toBe('VOLUME')
    expect(getUnitCategory(makeUnit({ symbol: 'pcs', category: null as unknown as UnitCategory }))).toBe('COUNT')
    expect(getUnitCategory(makeUnit({ symbol: 'box', category: null as unknown as UnitCategory }))).toBe('PACKAGING')
  })

  it('returns OTHER for unknown predefined symbols', () => {
    expect(getUnitCategory(makeUnit({ symbol: 'xyz', category: null as unknown as UnitCategory }))).toBe('OTHER')
  })

  it('returns OTHER for custom units without category', () => {
    expect(getUnitCategory(makeUnit({ type: 'CUSTOM', symbol: 'abc', category: null as unknown as UnitCategory }))).toBe('OTHER')
  })
})

// ─── groupUnitsByCategory ─────────────────────────────────────────────────────

describe('groupUnitsByCategory', () => {
  it('groups units by their category', () => {
    const units = [
      makeUnit({ id: '1', symbol: 'kg', category: 'WEIGHT' }),
      makeUnit({ id: '2', symbol: 'gm', category: 'WEIGHT' }),
      makeUnit({ id: '3', symbol: 'ltr', category: 'VOLUME' }),
    ]
    const groups = groupUnitsByCategory(units)
    expect(groups.get('WEIGHT')).toHaveLength(2)
    expect(groups.get('VOLUME')).toHaveLength(1)
  })

  it('returns empty map for empty array', () => {
    expect(groupUnitsByCategory([])).toEqual(new Map())
  })
})

// ─── formatUnitDisplay ────────────────────────────────────────────────────────

describe('formatUnitDisplay', () => {
  it('formats as "name (symbol)"', () => {
    expect(formatUnitDisplay(makeUnit({ name: 'kilogram', symbol: 'kg' }))).toBe('kilogram (kg)')
  })

  it('handles single-char symbol', () => {
    expect(formatUnitDisplay(makeUnit({ name: 'meter', symbol: 'm' }))).toBe('meter (m)')
  })
})

// ─── validateUnitName ─────────────────────────────────────────────────────────

describe('validateUnitName', () => {
  it('returns error for empty string', () => {
    expect(validateUnitName('')).toBe('Name is required')
  })

  it('returns error for whitespace-only', () => {
    expect(validateUnitName('   ')).toBe('Name is required')
  })

  it('returns error for name exceeding max length', () => {
    expect(validateUnitName('a'.repeat(31))).toMatch(/30 characters/)
  })

  it('returns null for valid name', () => {
    expect(validateUnitName('kilogram')).toBeNull()
  })
})

// ─── validateUnitSymbol ───────────────────────────────────────────────────────

describe('validateUnitSymbol', () => {
  it('returns error for empty string', () => {
    expect(validateUnitSymbol('')).toBe('Symbol is required')
  })

  it('returns error for symbol exceeding max length', () => {
    expect(validateUnitSymbol('a'.repeat(11))).toMatch(/10 characters/)
  })

  it('returns error for non-alphanumeric', () => {
    expect(validateUnitSymbol('kg!')).toBe('Symbol must be letters and numbers only')
    expect(validateUnitSymbol('k g')).toBe('Symbol must be letters and numbers only')
  })

  it('returns null for valid symbol', () => {
    expect(validateUnitSymbol('kg')).toBeNull()
    expect(validateUnitSymbol('m2')).toBeNull()
  })
})
