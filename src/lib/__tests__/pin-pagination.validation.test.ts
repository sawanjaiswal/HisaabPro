import { describe, it, expect } from 'vitest'
import { pinSchema, paginationSchema } from '../validation'

// ---------------------------------------------------------------------------
// pinSchema
// ---------------------------------------------------------------------------
describe('pinSchema', () => {
  it('accepts a 4-digit PIN', () => {
    expect(pinSchema.safeParse('1234').success).toBe(true)
  })

  it('accepts a 5-digit PIN', () => {
    expect(pinSchema.safeParse('12345').success).toBe(true)
  })

  it('accepts a 6-digit PIN', () => {
    expect(pinSchema.safeParse('123456').success).toBe(true)
  })

  it('rejects a 3-digit PIN (too short)', () => {
    expect(pinSchema.safeParse('123').success).toBe(false)
  })

  it('rejects a 7-digit PIN (too long)', () => {
    expect(pinSchema.safeParse('1234567').success).toBe(false)
  })

  it('rejects a PIN containing letters', () => {
    expect(pinSchema.safeParse('12ab').success).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(pinSchema.safeParse('').success).toBe(false)
  })

  it('includes a descriptive error message on failure', () => {
    const result = pinSchema.safeParse('12')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('PIN must be 4-6 digits')
    }
  })
})

// ---------------------------------------------------------------------------
// paginationSchema
// ---------------------------------------------------------------------------
describe('paginationSchema', () => {
  it('accepts an empty object and applies defaults', () => {
    const result = paginationSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(20)
      expect(result.data.cursor).toBeUndefined()
    }
  })

  it('accepts a valid limit within bounds', () => {
    const result = paginationSchema.safeParse({ limit: 50 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(50)
    }
  })

  it('accepts limit of 1 (boundary minimum)', () => {
    expect(paginationSchema.safeParse({ limit: 1 }).success).toBe(true)
  })

  it('accepts limit of 200 (boundary maximum)', () => {
    expect(paginationSchema.safeParse({ limit: 200 }).success).toBe(true)
  })

  it('rejects limit of 0 (below minimum)', () => {
    expect(paginationSchema.safeParse({ limit: 0 }).success).toBe(false)
  })

  it('rejects limit of 201 (above maximum)', () => {
    expect(paginationSchema.safeParse({ limit: 201 }).success).toBe(false)
  })

  it('rejects a float limit', () => {
    expect(paginationSchema.safeParse({ limit: 10.5 }).success).toBe(false)
  })

  it('accepts a cursor string', () => {
    const result = paginationSchema.safeParse({ cursor: 'cursor_abc123' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cursor).toBe('cursor_abc123')
    }
  })

  it('cursor is optional — omitting it is valid', () => {
    const result = paginationSchema.safeParse({ limit: 10 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cursor).toBeUndefined()
    }
  })
})
