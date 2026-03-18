import { describe, it, expect } from 'vitest'
import { validatePin, isWeakPin } from '../settings-pin.utils'

// ─── isWeakPin ────────────────────────────────────────────────────────────────

describe('isWeakPin', () => {
  it('detects common weak PINs', () => {
    expect(isWeakPin('1234')).toBe(true)
    expect(isWeakPin('0000')).toBe(true)
    expect(isWeakPin('1111')).toBe(true)
  })

  it('returns false for strong PINs', () => {
    expect(isWeakPin('7392')).toBe(false)
    expect(isWeakPin('84621')).toBe(false)
  })
})

// ─── validatePin ──────────────────────────────────────────────────────────────

describe('validatePin', () => {
  it('validates a good PIN', () => {
    const result = validatePin('7392')
    expect(result.valid).toBe(true)
    expect(result.weak).toBe(false)
    expect(result.error).toBeUndefined()
  })

  it('rejects non-digit characters', () => {
    const result = validatePin('12ab')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/digits only/)
  })

  it('rejects too-short PIN', () => {
    const result = validatePin('123')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/at least/)
  })

  it('rejects too-long PIN', () => {
    const result = validatePin('1234567')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/at most/)
  })

  it('flags weak PIN as valid but weak', () => {
    const result = validatePin('1234')
    expect(result.valid).toBe(true)
    expect(result.weak).toBe(true)
    expect(result.error).toMatch(/too simple/)
  })

  it('accepts 5-digit PIN', () => {
    const result = validatePin('73921')
    expect(result.valid).toBe(true)
    expect(result.weak).toBe(false)
  })

  it('accepts 6-digit PIN', () => {
    const result = validatePin('739218')
    expect(result.valid).toBe(true)
    expect(result.weak).toBe(false)
  })
})
