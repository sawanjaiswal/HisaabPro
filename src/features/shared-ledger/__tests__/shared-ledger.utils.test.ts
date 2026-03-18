import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isShareExpired, formatExpiry } from '../shared-ledger.utils'

// ─── isShareExpired ───────────────────────────────────────────────────────────

describe('isShareExpired', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns false when no expiry', () => {
    expect(isShareExpired({ expiresAt: null } as never)).toBe(false)
  })

  it('returns true when expired', () => {
    vi.setSystemTime(new Date('2026-03-20T12:00:00Z'))
    expect(isShareExpired({ expiresAt: '2026-03-18T12:00:00Z' } as never)).toBe(true)
  })

  it('returns false when not expired', () => {
    vi.setSystemTime(new Date('2026-03-18T12:00:00Z'))
    expect(isShareExpired({ expiresAt: '2026-03-20T12:00:00Z' } as never)).toBe(false)
  })
})

// ─── formatExpiry ─────────────────────────────────────────────────────────────

describe('formatExpiry', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns "Never" for null', () => {
    expect(formatExpiry(null)).toBe('Never')
  })

  it('returns "Expired" for past date', () => {
    vi.setSystemTime(new Date('2026-03-20T12:00:00Z'))
    expect(formatExpiry('2026-03-18T12:00:00Z')).toBe('Expired')
  })

  it('returns "Expires today" for same instant', () => {
    vi.setSystemTime(new Date('2026-03-18T12:00:00Z'))
    // diffDays = ceil(0) = 0 → "Expires today"
    expect(formatExpiry('2026-03-18T12:00:00Z')).toBe('Expires today')
  })

  it('returns "Expires tomorrow" for next day', () => {
    vi.setSystemTime(new Date('2026-03-18T12:00:00Z'))
    // diffDays = ceil(1.0) = 1 → "Expires tomorrow"
    expect(formatExpiry('2026-03-19T12:00:00Z')).toBe('Expires tomorrow')
  })

  it('returns "Expires in N days" for future', () => {
    vi.setSystemTime(new Date('2026-03-18T00:00:00Z'))
    expect(formatExpiry('2026-03-25T12:00:00Z')).toMatch(/Expires in \d+ days/)
  })
})
