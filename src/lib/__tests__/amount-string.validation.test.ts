import { describe, it, expect } from 'vitest'
import { paiseSchema, requiredString } from '../validation'

// ---------------------------------------------------------------------------
// paiseSchema
// ---------------------------------------------------------------------------
describe('paiseSchema', () => {
  it('accepts 0 paise (free item)', () => {
    expect(paiseSchema.safeParse(0).success).toBe(true)
  })

  it('accepts a positive integer paise value', () => {
    expect(paiseSchema.safeParse(10000).success).toBe(true)
  })

  it('accepts a large paise value (₹1 crore = 10,00,00,000 paise)', () => {
    expect(paiseSchema.safeParse(1_00_00_000_00).success).toBe(true)
  })

  it('rejects a negative paise value', () => {
    expect(paiseSchema.safeParse(-1).success).toBe(false)
  })

  it('rejects a float (e.g., 10.5)', () => {
    expect(paiseSchema.safeParse(10.5).success).toBe(false)
  })

  it('rejects a string', () => {
    expect(paiseSchema.safeParse('500').success).toBe(false)
  })

  it('includes a descriptive error message for floats', () => {
    const result = paiseSchema.safeParse(99.99)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Amount must be a whole number (paise)',
      )
    }
  })

  it('includes a descriptive error message for negatives', () => {
    const result = paiseSchema.safeParse(-100)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Amount cannot be negative')
    }
  })
})

// ---------------------------------------------------------------------------
// requiredString
// ---------------------------------------------------------------------------
describe('requiredString', () => {
  it('accepts a non-empty string', () => {
    expect(requiredString.safeParse('hello').success).toBe(true)
  })

  it('trims whitespace and accepts the result', () => {
    const result = requiredString.safeParse('  hello  ')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('hello')
    }
  })

  it('rejects an empty string', () => {
    expect(requiredString.safeParse('').success).toBe(false)
  })

  it('rejects a whitespace-only string (trims to empty)', () => {
    expect(requiredString.safeParse('   ').success).toBe(false)
  })

  it('includes a descriptive error message on failure', () => {
    const result = requiredString.safeParse('')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('This field is required')
    }
  })
})
