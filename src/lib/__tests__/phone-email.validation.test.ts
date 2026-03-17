import { describe, it, expect } from 'vitest'
import { phoneSchema, emailSchema } from '../validation'

// ---------------------------------------------------------------------------
// phoneSchema
// ---------------------------------------------------------------------------
describe('phoneSchema', () => {
  it('accepts a valid 10-digit Indian phone starting with 6', () => {
    expect(phoneSchema.safeParse('6123456789').success).toBe(true)
  })

  it('accepts a valid 10-digit Indian phone starting with 7', () => {
    expect(phoneSchema.safeParse('7000000000').success).toBe(true)
  })

  it('accepts a valid 10-digit Indian phone starting with 8', () => {
    expect(phoneSchema.safeParse('8999999999').success).toBe(true)
  })

  it('accepts a valid 10-digit Indian phone starting with 9', () => {
    expect(phoneSchema.safeParse('9876543210').success).toBe(true)
  })

  it('rejects a number starting with 5 (invalid for India)', () => {
    expect(phoneSchema.safeParse('5123456789').success).toBe(false)
  })

  it('rejects a number starting with 0', () => {
    expect(phoneSchema.safeParse('0123456789').success).toBe(false)
  })

  it('rejects a number with fewer than 10 digits', () => {
    expect(phoneSchema.safeParse('912345678').success).toBe(false)
  })

  it('rejects a number with more than 10 digits', () => {
    expect(phoneSchema.safeParse('98765432101').success).toBe(false)
  })

  it('rejects a non-numeric string', () => {
    expect(phoneSchema.safeParse('abcdefghij').success).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(phoneSchema.safeParse('').success).toBe(false)
  })

  it('includes a descriptive error message on failure', () => {
    const result = phoneSchema.safeParse('1234567890')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Enter a valid 10-digit Indian phone number',
      )
    }
  })
})

// ---------------------------------------------------------------------------
// emailSchema
// ---------------------------------------------------------------------------
describe('emailSchema', () => {
  it('accepts a standard email address', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true)
  })

  it('accepts an email with sub-domain', () => {
    expect(emailSchema.safeParse('user@mail.example.co.in').success).toBe(true)
  })

  it('accepts an email with plus-addressing', () => {
    expect(emailSchema.safeParse('user+tag@example.com').success).toBe(true)
  })

  it('rejects a string without @', () => {
    expect(emailSchema.safeParse('userexample.com').success).toBe(false)
  })

  it('rejects a string without domain', () => {
    expect(emailSchema.safeParse('user@').success).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(emailSchema.safeParse('').success).toBe(false)
  })

  it('includes a descriptive error message on failure', () => {
    const result = emailSchema.safeParse('not-an-email')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Enter a valid email address')
    }
  })
})
