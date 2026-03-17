import { describe, it, expect } from 'vitest'
import {
  validatePin,
  isWeakPin,
  formatPermissionKey,
  parsePermissionKey,
  getPermissionCount,
  formatLockPeriod,
  applyPercentage,
  calculateMarkup,
  calculateGst,
  evaluateExpression,
  formatShortcutKey,
} from '../settings.utils'

// ─── PIN Validation ──────────────────────────────────────────────────────────

describe('validatePin', () => {
  it('rejects non-digit input', () => {
    const result = validatePin('12ab')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/digits only/)
  })

  it('rejects too-short PIN', () => {
    const result = validatePin('12')
    expect(result.valid).toBe(false)
  })

  it('rejects too-long PIN', () => {
    const result = validatePin('12345678')
    expect(result.valid).toBe(false)
  })

  it('accepts valid PIN', () => {
    const result = validatePin('4829')
    expect(result.valid).toBe(true)
    expect(result.weak).toBe(false)
  })

  it('flags weak PIN as valid but weak', () => {
    const result = validatePin('1234')
    expect(result.valid).toBe(true)
    expect(result.weak).toBe(true)
  })
})

describe('isWeakPin', () => {
  it('detects common weak PINs', () => {
    expect(isWeakPin('0000')).toBe(true)
    expect(isWeakPin('1234')).toBe(true)
  })

  it('accepts strong PINs', () => {
    expect(isWeakPin('7392')).toBe(false)
  })
})

// ─── Permission helpers ──────────────────────────────────────────────────────

describe('formatPermissionKey', () => {
  it('joins module and action', () => {
    expect(formatPermissionKey('invoicing', 'view')).toBe('invoicing.view')
  })
})

describe('parsePermissionKey', () => {
  it('splits dot-separated key', () => {
    expect(parsePermissionKey('invoicing.create')).toEqual({
      module: 'invoicing',
      action: 'create',
    })
  })

  it('handles key without dot', () => {
    expect(parsePermissionKey('invoicing')).toEqual({
      module: 'invoicing',
      action: '',
    })
  })
})

describe('getPermissionCount', () => {
  it('counts granted permissions for a module', () => {
    const perms = ['invoicing.view', 'invoicing.create', 'parties.view']
    expect(getPermissionCount(perms, 'invoicing', 4)).toEqual({
      granted: 2,
      total: 4,
    })
  })
})

// ─── Lock period ─────────────────────────────────────────────────────────────

describe('formatLockPeriod', () => {
  it('returns "Never" for null', () => {
    expect(formatLockPeriod(null)).toBe('Never')
  })

  it('returns "1 day" for 1', () => {
    expect(formatLockPeriod(1)).toBe('1 day')
  })

  it('returns "N days" for > 1', () => {
    expect(formatLockPeriod(7)).toBe('7 days')
  })
})

// ─── Percentage & Markup ─────────────────────────────────────────────────────

describe('applyPercentage', () => {
  it('adds percentage', () => {
    expect(applyPercentage(1000, 18, 'add')).toBe(1180)
  })

  it('subtracts percentage', () => {
    expect(applyPercentage(1000, 18, 'subtract')).toBe(820)
  })
})

describe('calculateMarkup', () => {
  it('calculates selling price from cost + margin', () => {
    expect(calculateMarkup(100, 20)).toBe(125)
  })

  it('returns null for margin >= 100', () => {
    expect(calculateMarkup(100, 100)).toBeNull()
    expect(calculateMarkup(100, 150)).toBeNull()
  })
})

// ─── GST Calculation ─────────────────────────────────────────────────────────

describe('calculateGst', () => {
  it('calculates exclusive GST', () => {
    const result = calculateGst(1000, 18, 'exclusive')
    expect(result.base).toBe(1000)
    expect(result.gst).toBe(180)
    expect(result.total).toBe(1180)
  })

  it('calculates inclusive GST', () => {
    const result = calculateGst(1180, 18, 'inclusive')
    expect(result.base).toBe(1000)
    expect(result.gst).toBe(180)
    expect(result.total).toBe(1180)
  })

  it('handles zero rate', () => {
    const result = calculateGst(1000, 0, 'exclusive')
    expect(result.gst).toBe(0)
    expect(result.total).toBe(1000)
  })
})

// ─── Expression Evaluator ────────────────────────────────────────────────────

describe('evaluateExpression', () => {
  it('evaluates simple addition', () => {
    expect(evaluateExpression('2 + 3')).toBe(5)
  })

  it('respects operator precedence', () => {
    expect(evaluateExpression('2 + 3 * 4')).toBe(14)
  })

  it('evaluates percentage add', () => {
    expect(evaluateExpression('100 + 18%')).toBe(118)
  })

  it('evaluates percentage subtract', () => {
    expect(evaluateExpression('100 - 10%')).toBe(90)
  })

  it('returns null for division by zero', () => {
    expect(evaluateExpression('10 / 0')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(evaluateExpression('')).toBeNull()
  })

  it('returns null for invalid input', () => {
    expect(evaluateExpression('abc')).toBeNull()
  })

  it('handles decimals', () => {
    expect(evaluateExpression('1.5 + 2.5')).toBe(4)
  })

  it('handles chained operations', () => {
    expect(evaluateExpression('10 + 5 - 3')).toBe(12)
  })
})

// ─── Shortcut formatting ────────────────────────────────────────────────────

describe('formatShortcutKey', () => {
  it('formats Ctrl + key', () => {
    expect(formatShortcutKey({ key: 'n', ctrl: true, label: 'New' })).toBe('Ctrl + N')
  })

  it('formats special keys', () => {
    expect(formatShortcutKey({ key: 'Escape', label: 'Close' })).toBe('Esc')
  })

  it('formats multiple modifiers', () => {
    expect(formatShortcutKey({ key: 's', ctrl: true, shift: true, label: 'Save' })).toBe(
      'Ctrl + Shift + S',
    )
  })
})
