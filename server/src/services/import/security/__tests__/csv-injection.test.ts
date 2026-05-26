import { describe, it, expect } from 'vitest'
import {
  prefixUnsafeCell,
  sanitizeCsvRow,
  sanitizeForPreviewJson,
} from '../csv-injection.js'

describe('prefixUnsafeCell', () => {
  it('prefixes leading =', () => {
    expect(prefixUnsafeCell('=cmd|/c calc!A0')).toBe(`'=cmd|/c calc!A0`)
  })

  it('prefixes leading +', () => {
    expect(prefixUnsafeCell('+1234')).toBe(`'+1234`)
  })

  it('prefixes leading -', () => {
    expect(prefixUnsafeCell('-SUM(1)')).toBe(`'-SUM(1)`)
  })

  it('prefixes leading @', () => {
    expect(prefixUnsafeCell('@SUM(A1)')).toBe(`'@SUM(A1)`)
  })

  it('prefixes leading tab', () => {
    expect(prefixUnsafeCell('\tHello')).toBe(`'\tHello`)
  })

  it('prefixes leading carriage return', () => {
    expect(prefixUnsafeCell('\rEvil')).toBe(`'\rEvil`)
  })

  it('leaves plain business strings unchanged', () => {
    expect(prefixUnsafeCell('Raju Traders')).toBe('Raju Traders')
  })

  it('leaves empty string unchanged', () => {
    expect(prefixUnsafeCell('')).toBe('')
  })

  it('leaves leading rupee amount unchanged', () => {
    expect(prefixUnsafeCell('1500')).toBe('1500')
    expect(prefixUnsafeCell('Rs 1,00,000')).toBe('Rs 1,00,000')
  })
})

describe('sanitizeCsvRow', () => {
  it('applies prefixing to every column', () => {
    const row = {
      name: '=BAD()',
      phone: '9999999999',
      note: '+xss',
    }
    expect(sanitizeCsvRow(row)).toEqual({
      name: `'=BAD()`,
      phone: '9999999999',
      note: `'+xss`,
    })
  })

  it('handles undefined-ish empty cells', () => {
    // simulate a key that exists but is empty string
    const row: Record<string, string> = { a: '', b: 'ok' }
    expect(sanitizeCsvRow(row)).toEqual({ a: '', b: 'ok' })
  })
})

describe('sanitizeForPreviewJson (S12)', () => {
  it('prefixes string formulae but preserves numbers / booleans / null', () => {
    const row = {
      partyName: '=cmd|calc',
      amountPaise: 150000,
      isPaid: true,
      noteOrNull: null,
      note: 'Raju',
      plus: '+1234',
    }
    expect(sanitizeForPreviewJson(row)).toEqual({
      partyName: `'=cmd|calc`,
      amountPaise: 150000,
      isPaid: true,
      noteOrNull: null,
      note: 'Raju',
      plus: `'+1234`,
    })
  })

  it('round-trips an entirely safe row unchanged', () => {
    const row = { name: 'Priya Wholesale', amount: 250000, gst: false }
    expect(sanitizeForPreviewJson(row)).toEqual(row)
  })
})
