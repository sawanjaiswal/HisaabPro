import { describe, it, expect } from 'vitest'
import { sanitizeControlChars } from '../security/unicode.js'

describe('sanitizeControlChars (M6)', () => {
  it('strips zero-width "Re​ynolds" → "Reynolds"', () => {
    expect(sanitizeControlChars('Re​ynolds')).toBe('Reynolds')
  })

  it('strips RTL override "‮Reynolds"', () => {
    expect(sanitizeControlChars('‮Reynolds')).toBe('Reynolds')
  })

  it('strips ASCII control \\x01 + \\x1F', () => {
    expect(sanitizeControlChars('Re\x01ynolds\x1F')).toBe('Reynolds')
  })

  it('NFKC fullwidth "Ｐｅｎ" → "Pen"', () => {
    expect(sanitizeControlChars('Ｐｅｎ')).toBe('Pen')
  })

  it('max-len truncates AFTER NFKC + trim', () => {
    expect(sanitizeControlChars('a'.repeat(500), { maxLen: 10 })).toBe('a'.repeat(10))
  })

  it('empty / null-ish guards', () => {
    expect(sanitizeControlChars('')).toBe('')
    // @ts-expect-error — testing runtime guard
    expect(sanitizeControlChars(undefined)).toBe('')
  })
})
