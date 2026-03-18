import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatLockPeriod, formatTimeAgo, formatShortcutKey } from '../settings-format.utils'

// ─── formatLockPeriod ─────────────────────────────────────────────────────────

describe('formatLockPeriod', () => {
  it('returns "Never" for null', () => {
    expect(formatLockPeriod(null)).toBe('Never')
  })

  it('returns "1 day" for 1', () => {
    expect(formatLockPeriod(1)).toBe('1 day')
  })

  it('returns plural for > 1', () => {
    expect(formatLockPeriod(7)).toBe('7 days')
    expect(formatLockPeriod(30)).toBe('30 days')
  })
})

// ─── formatTimeAgo ────────────────────────────────────────────────────────────

describe('formatTimeAgo', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns "Just now" for recent times', () => {
    vi.setSystemTime(new Date('2026-03-18T12:00:00Z'))
    expect(formatTimeAgo('2026-03-18T11:59:30Z')).toBe('Just now')
  })

  it('returns minutes ago', () => {
    vi.setSystemTime(new Date('2026-03-18T12:05:00Z'))
    expect(formatTimeAgo('2026-03-18T12:00:00Z')).toBe('5m ago')
  })

  it('returns hours ago', () => {
    vi.setSystemTime(new Date('2026-03-18T15:00:00Z'))
    expect(formatTimeAgo('2026-03-18T12:00:00Z')).toBe('3h ago')
  })

  it('returns days ago', () => {
    vi.setSystemTime(new Date('2026-03-20T12:00:00Z'))
    expect(formatTimeAgo('2026-03-18T12:00:00Z')).toBe('2d ago')
  })

  it('returns months ago', () => {
    vi.setSystemTime(new Date('2026-06-18T12:00:00Z'))
    expect(formatTimeAgo('2026-03-18T12:00:00Z')).toBe('3mo ago')
  })

  it('returns years ago', () => {
    vi.setSystemTime(new Date('2028-03-18T12:00:00Z'))
    expect(formatTimeAgo('2026-03-18T12:00:00Z')).toBe('2y ago')
  })

  it('returns "—" for invalid date', () => {
    expect(formatTimeAgo('not-a-date')).toBe('—')
  })

  it('returns "Just now" for future date (clock skew)', () => {
    vi.setSystemTime(new Date('2026-03-18T12:00:00Z'))
    expect(formatTimeAgo('2026-03-18T13:00:00Z')).toBe('Just now')
  })
})

// ─── formatShortcutKey ────────────────────────────────────────────────────────

describe('formatShortcutKey', () => {
  it('formats Ctrl + key', () => {
    expect(formatShortcutKey({ key: 'n', ctrl: true })).toBe('Ctrl + N')
  })

  it('formats multiple modifiers', () => {
    expect(formatShortcutKey({ key: 's', ctrl: true, shift: true })).toBe('Ctrl + Shift + S')
  })

  it('formats special keys', () => {
    expect(formatShortcutKey({ key: 'Enter' })).toBe('Enter')
    expect(formatShortcutKey({ key: 'Escape' })).toBe('Esc')
    expect(formatShortcutKey({ key: ' ' })).toBe('Space')
  })

  it('formats plain key without modifiers', () => {
    expect(formatShortcutKey({ key: 'f' })).toBe('F')
  })
})
