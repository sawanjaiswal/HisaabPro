import { describe, it, expect } from 'vitest'

// ─── Invite code cleaning logic (mirrors useJoinBusiness.handleCodeChange) ──

function cleanInviteCode(value: string): string {
  return value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6)
}

describe('invite code cleaning', () => {
  it('uppercases input', () => {
    expect(cleanInviteCode('abc123')).toBe('ABC123')
  })

  it('strips non-alphanumeric chars', () => {
    expect(cleanInviteCode('AB-C1.2 3')).toBe('ABC123')
  })

  it('truncates to 6 characters', () => {
    expect(cleanInviteCode('ABCDEFGH')).toBe('ABCDEF')
  })

  it('handles empty input', () => {
    expect(cleanInviteCode('')).toBe('')
  })

  it('handles all-special-char input', () => {
    expect(cleanInviteCode('!@#$%^')).toBe('')
  })

  it('preserves valid 6-char code', () => {
    expect(cleanInviteCode('XY7K9M')).toBe('XY7K9M')
  })

  it('handles mixed case', () => {
    expect(cleanInviteCode('aBcDeF')).toBe('ABCDEF')
  })

  it('handles unicode/emoji', () => {
    expect(cleanInviteCode('🔑ABC')).toBe('ABC')
  })
})

// ─── Create business name validation (mirrors useCreateBusiness.validate) ───

import { BUSINESS_NAME_MIN, BUSINESS_NAME_MAX } from '../business.constants'

function validateBusinessName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length < BUSINESS_NAME_MIN) {
    return `Name must be at least ${BUSINESS_NAME_MIN} characters`
  }
  if (trimmed.length > BUSINESS_NAME_MAX) {
    return `Name must be ${BUSINESS_NAME_MAX} characters or fewer`
  }
  return null
}

describe('business name validation', () => {
  it('accepts valid name', () => {
    expect(validateBusinessName('Sharma Trading')).toBeNull()
  })

  it('accepts minimum length name', () => {
    expect(validateBusinessName('AB')).toBeNull()
  })

  it('rejects empty name', () => {
    expect(validateBusinessName('')).toContain('at least')
  })

  it('rejects single character', () => {
    expect(validateBusinessName('A')).toContain('at least')
  })

  it('rejects whitespace-only name', () => {
    expect(validateBusinessName('   ')).toContain('at least')
  })

  it('trims before validating', () => {
    // "  AB  " trims to "AB" which is 2 chars = valid
    expect(validateBusinessName('  AB  ')).toBeNull()
  })

  it('rejects name exceeding max length', () => {
    const longName = 'A'.repeat(BUSINESS_NAME_MAX + 1)
    expect(validateBusinessName(longName)).toContain('or fewer')
  })

  it('accepts name at max length', () => {
    const maxName = 'A'.repeat(BUSINESS_NAME_MAX)
    expect(validateBusinessName(maxName)).toBeNull()
  })
})
