import { describe, it, expect } from 'vitest'
import {
  validateGstin,
  extractStateCode,
  determineSupplyType,
  formatGstRate,
} from '../gstin.utils'

// ─── GSTIN validation ───────────────────────────────────────────────────────

describe('validateGstin', () => {
  it('rejects empty string', () => {
    const result = validateGstin('')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/15 characters/)
  })

  it('rejects null-ish (empty)', () => {
    const result = validateGstin('')
    expect(result.valid).toBe(false)
  })

  it('rejects wrong length (too short)', () => {
    const result = validateGstin('29AABCU9603R')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/15 characters/)
  })

  it('rejects wrong length (too long)', () => {
    const result = validateGstin('29AABCU9603R1Z55X')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/15 characters/)
  })

  it('rejects invalid format (lowercase)', () => {
    const result = validateGstin('29aabcu9603r1z5')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/Invalid GSTIN format/)
  })

  it('rejects invalid format (wrong pattern)', () => {
    const result = validateGstin('XXAABCU9603R1Z5')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/Invalid GSTIN format/)
  })

  it('rejects state code 0 (below range)', () => {
    const result = validateGstin('00AABCU9603R1Z5')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/Invalid state code/)
  })

  it('rejects state code above 38', () => {
    const result = validateGstin('39AABCU9603R1Z5')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/Invalid state code/)
  })

  it('accepts valid GSTIN (Karnataka, state code 29)', () => {
    const result = validateGstin('29AABCU9603R1Z5')
    expect(result.valid).toBe(true)
    expect(result.stateCode).toBe('29')
    expect(result.error).toBeUndefined()
  })

  it('accepts valid GSTIN (Maharashtra, state code 27)', () => {
    const result = validateGstin('27AAPFU0939F1ZV')
    expect(result.valid).toBe(true)
    expect(result.stateCode).toBe('27')
  })

  it('accepts valid GSTIN with state code 01', () => {
    const result = validateGstin('01AABCU9603R1Z5')
    expect(result.valid).toBe(true)
    expect(result.stateCode).toBe('01')
  })

  it('accepts valid GSTIN with state code 38 (boundary)', () => {
    const result = validateGstin('38AABCU9603R1Z5')
    expect(result.valid).toBe(true)
    expect(result.stateCode).toBe('38')
  })
})

// ─── State code extraction ──────────────────────────────────────────────────

describe('extractStateCode', () => {
  it('returns null for null input', () => {
    expect(extractStateCode(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractStateCode('')).toBeNull()
  })

  it('returns null for single character', () => {
    expect(extractStateCode('2')).toBeNull()
  })

  it('extracts state code from full GSTIN', () => {
    expect(extractStateCode('29AABCU9603R1Z5')).toBe('29')
  })

  it('extracts first 2 chars even from short strings', () => {
    expect(extractStateCode('27')).toBe('27')
  })
})

// ─── Supply type determination ──────────────────────────────────────────────

describe('determineSupplyType', () => {
  it('returns B2B when party has GSTIN', () => {
    expect(determineSupplyType('29AABCU9603R1Z5', false, 10_000)).toBe('B2B')
  })

  it('returns B2B for inter-state with GSTIN', () => {
    expect(determineSupplyType('29AABCU9603R1Z5', true, 30_000_000)).toBe('B2B')
  })

  it('returns B2C_LARGE for no GSTIN + inter-state + amount > Rs 2.5L', () => {
    // Rs 2.5L = 25_000_000 paise, so > 25_000_000
    expect(determineSupplyType(null, true, 25_000_001)).toBe('B2C_LARGE')
  })

  it('returns B2C_SMALL for no GSTIN + inter-state + amount exactly Rs 2.5L', () => {
    // Boundary: exactly 25_000_000 is NOT > 25_000_000
    expect(determineSupplyType(null, true, 25_000_000)).toBe('B2C_SMALL')
  })

  it('returns B2C_SMALL for no GSTIN + intra-state', () => {
    expect(determineSupplyType(null, false, 50_000_000)).toBe('B2C_SMALL')
  })

  it('returns B2C_SMALL for no GSTIN + inter-state + small amount', () => {
    expect(determineSupplyType(null, true, 10_000)).toBe('B2C_SMALL')
  })

  it('returns B2C_SMALL for empty GSTIN string', () => {
    // Empty string is falsy → treated as no GSTIN
    expect(determineSupplyType('', false, 10_000)).toBe('B2C_SMALL')
  })
})

// ─── GST rate formatting ────────────────────────────────────────────────────

describe('formatGstRate', () => {
  it('formats whole percentage (18%)', () => {
    expect(formatGstRate(1800)).toBe('18%')
  })

  it('formats zero rate', () => {
    expect(formatGstRate(0)).toBe('0%')
  })

  it('formats 5%', () => {
    expect(formatGstRate(500)).toBe('5%')
  })

  it('formats 12%', () => {
    expect(formatGstRate(1200)).toBe('12%')
  })

  it('formats 28%', () => {
    expect(formatGstRate(2800)).toBe('28%')
  })

  it('formats fractional percentage (0.25%)', () => {
    expect(formatGstRate(25)).toBe('0.25%')
  })

  it('formats fractional percentage (1.5%)', () => {
    expect(formatGstRate(150)).toBe('1.50%')
  })

  it('formats 0.1%', () => {
    expect(formatGstRate(10)).toBe('0.10%')
  })
})
