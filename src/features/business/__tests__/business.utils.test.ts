import { describe, it, expect } from 'vitest'
import { getBusinessInitials, getBusinessColor } from '../business.utils'
import { AVATAR_COLORS, BUSINESS_NAME_MIN, BUSINESS_NAME_MAX, BUSINESS_TYPE_OPTIONS } from '../business.constants'

// ─── getBusinessInitials ────────────────────────────────────────────────────

describe('getBusinessInitials', () => {
  it('returns first letters of two words', () => {
    expect(getBusinessInitials('Sharma Trading')).toBe('ST')
  })

  it('returns first two chars for single word', () => {
    expect(getBusinessInitials('Amazon')).toBe('AM')
  })

  it('handles multi-word names (uses first two words)', () => {
    expect(getBusinessInitials('Raju General Store')).toBe('RG')
  })

  it('uppercases the result', () => {
    expect(getBusinessInitials('my shop')).toBe('MS')
  })

  it('handles extra whitespace', () => {
    expect(getBusinessInitials('  padded  name  ')).toBe('PN')
  })

  it('handles single character name', () => {
    expect(getBusinessInitials('A')).toBe('A')
  })

  it('handles two character name', () => {
    expect(getBusinessInitials('AB')).toBe('AB')
  })
})

// ─── getBusinessColor ───────────────────────────────────────────────────────

describe('getBusinessColor', () => {
  it('returns a color from the palette', () => {
    const color = getBusinessColor('abc123')
    expect(AVATAR_COLORS).toContain(color)
  })

  it('is deterministic (same ID = same color)', () => {
    const id = 'business-xyz-789'
    expect(getBusinessColor(id)).toBe(getBusinessColor(id))
  })

  it('returns different colors for different IDs', () => {
    // Not guaranteed but statistically very likely for distinct strings
    const colors = new Set([
      getBusinessColor('aaa'),
      getBusinessColor('bbb'),
      getBusinessColor('ccc'),
      getBusinessColor('ddd'),
    ])
    expect(colors.size).toBeGreaterThan(1)
  })

  it('handles empty string without crashing', () => {
    const color = getBusinessColor('')
    expect(AVATAR_COLORS).toContain(color)
  })

  it('handles long IDs', () => {
    const longId = 'a'.repeat(500)
    const color = getBusinessColor(longId)
    expect(AVATAR_COLORS).toContain(color)
  })
})

// ─── Constants ──────────────────────────────────────────────────────────────

describe('business constants', () => {
  it('AVATAR_COLORS has 8 hex colors', () => {
    expect(AVATAR_COLORS).toHaveLength(8)
    for (const c of AVATAR_COLORS) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('BUSINESS_TYPE_OPTIONS has valid entries', () => {
    expect(BUSINESS_TYPE_OPTIONS.length).toBeGreaterThanOrEqual(3)
    for (const opt of BUSINESS_TYPE_OPTIONS) {
      expect(opt.value).toBeTruthy()
      expect(opt.label).toBeTruthy()
    }
  })

  it('name constraints are sensible', () => {
    expect(BUSINESS_NAME_MIN).toBeGreaterThanOrEqual(1)
    expect(BUSINESS_NAME_MAX).toBeLessThanOrEqual(100)
    expect(BUSINESS_NAME_MIN).toBeLessThan(BUSINESS_NAME_MAX)
  })
})
