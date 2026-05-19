import { describe, it, expect } from 'vitest'
import { validateHsn } from '../utils/hsn.util.js'

describe('validateHsn', () => {
  it('4-digit passes', () => {
    expect(validateHsn('1234')).toEqual({ hsn: '1234' })
  })

  it('6-digit passes', () => {
    expect(validateHsn('123456')).toEqual({ hsn: '123456' })
  })

  it('8-digit passes', () => {
    expect(validateHsn('12345678')).toEqual({ hsn: '12345678' })
  })

  it('5-digit fails → HSN_INVALID', () => {
    const r = validateHsn('12345')
    expect(r.hsn).toBeNull()
    expect(r.issue).toBe('HSN_INVALID')
  })

  it('alpha fails → HSN_INVALID', () => {
    const r = validateHsn('12AB')
    expect(r.hsn).toBeNull()
    expect(r.issue).toBe('HSN_INVALID')
  })

  it('null/empty → pass-through (HSN is optional)', () => {
    expect(validateHsn(null)).toEqual({ hsn: null })
    expect(validateHsn('')).toEqual({ hsn: null })
    expect(validateHsn(undefined)).toEqual({ hsn: null })
  })

  it('whitespace-only → pass-through (cleaned to empty)', () => {
    expect(validateHsn('   ').issue).toBeUndefined()
  })
})
