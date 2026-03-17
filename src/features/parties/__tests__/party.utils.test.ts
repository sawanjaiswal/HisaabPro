import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  paisaToRupees,
  formatAmount,
  formatOutstanding,
  extractPanFromGstin,
  rupeesToPaise,
  paiseToRupeesNum,
  formatPhone,
  timeAgo,
} from '../party.utils'
import { getInitial, getAvatarColor } from '../../../components/ui/PartyAvatar'

// ─── Currency formatting ─────────────────────────────────────────────────────

describe('paisaToRupees', () => {
  it('formats with Indian grouping', () => {
    // 500000 paise = Rs 5,000
    expect(paisaToRupees(500000)).toMatch(/5,000/)
  })

  it('handles negative (takes absolute)', () => {
    expect(paisaToRupees(-500000)).toMatch(/5,000/)
  })

  it('omits decimals for whole rupees', () => {
    expect(paisaToRupees(100000)).not.toMatch(/\./)
  })

  it('shows decimals for fractional rupees', () => {
    expect(paisaToRupees(50050)).toMatch(/\.50/)
  })
})

describe('formatAmount', () => {
  it('prepends Rs', () => {
    expect(formatAmount(100000)).toMatch(/^Rs /)
  })
})

describe('formatOutstanding', () => {
  it('returns zero as receivable', () => {
    const result = formatOutstanding(0)
    expect(result.text).toBe('Rs 0')
    expect(result.isReceivable).toBe(true)
  })

  it('marks positive as receivable', () => {
    const result = formatOutstanding(50000)
    expect(result.isReceivable).toBe(true)
  })

  it('marks negative as payable', () => {
    const result = formatOutstanding(-50000)
    expect(result.isReceivable).toBe(false)
  })
})

// ─── Initials (shared PartyAvatar) ───────────────────────────────────────────

describe('getInitial', () => {
  it('extracts first letter', () => {
    expect(getInitial('Rahul Traders')).toBe('R')
  })

  it('extracts first letter for single word', () => {
    expect(getInitial('Priya')).toBe('P')
  })

  it('returns U for empty/null', () => {
    expect(getInitial(null)).toBe('U')
    expect(getInitial('')).toBe('U')
  })
})

// ─── Avatar color (shared PartyAvatar) ───────────────────────────────────────

describe('getAvatarColor', () => {
  it('is deterministic', () => {
    expect(getAvatarColor('Test')).toBe(getAvatarColor('Test'))
  })
})

// ─── GSTIN → PAN ─────────────────────────────────────────────────────────────

describe('extractPanFromGstin', () => {
  it('extracts PAN from 15-char GSTIN', () => {
    // GSTIN: 29ABCDE1234F1Z5 → PAN: ABCDE1234F
    expect(extractPanFromGstin('29ABCDE1234F1Z5')).toBe('ABCDE1234F')
  })

  it('returns empty for non-15-char input', () => {
    expect(extractPanFromGstin('SHORT')).toBe('')
  })
})

// ─── Paise conversion ────────────────────────────────────────────────────────

describe('rupeesToPaise / paiseToRupeesNum', () => {
  it('converts rupees to paise', () => {
    expect(rupeesToPaise(500.50)).toBe(50050)
  })

  it('converts paise to rupees number', () => {
    expect(paiseToRupeesNum(50050)).toBe(500.50)
  })
})

// ─── Phone formatting ────────────────────────────────────────────────────────

describe('formatPhone', () => {
  it('formats 10-digit number', () => {
    expect(formatPhone('9876543210')).toBe('+91 98765 43210')
  })

  it('returns non-10-digit as-is', () => {
    expect(formatPhone('12345')).toBe('12345')
  })
})

// ─── Time ago ────────────────────────────────────────────────────────────────

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-17T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Just now" for recent', () => {
    expect(timeAgo('2026-03-17T11:59:50.000Z')).toBe('Just now')
  })

  it('returns minutes ago', () => {
    expect(timeAgo('2026-03-17T11:55:00.000Z')).toBe('5m ago')
  })

  it('returns days ago', () => {
    expect(timeAgo('2026-03-15T12:00:00.000Z')).toBe('2d ago')
  })
})
