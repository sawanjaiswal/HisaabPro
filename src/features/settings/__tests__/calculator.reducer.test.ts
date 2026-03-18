import { describe, it, expect } from 'vitest'
import {
  INITIAL_STATE,
  endsWithOperand,
  reduceKeyPress,
  reduceOperator,
  reduceEquals,
  reduceClear,
  reduceBackspace,
  reducePercent,
  reduceSetGstRate,
  reduceToggleGstMode,
  reduceGT,
  reduceMU,
  reducePercentPreset,
  reduceGstPreset,
} from '../calculator.reducer'

// ─── endsWithOperand ──────────────────────────────────────────────────────────

describe('endsWithOperand', () => {
  it('returns true for digit', () => {
    expect(endsWithOperand('123')).toBe(true)
  })

  it('returns true for decimal', () => {
    expect(endsWithOperand('12.5')).toBe(true)
  })

  it('returns false for operator', () => {
    expect(endsWithOperand('12+')).toBe(false)
  })
})

// ─── reduceKeyPress ───────────────────────────────────────────────────────────

describe('reduceKeyPress', () => {
  it('replaces 0 with digit', () => {
    const next = reduceKeyPress(INITIAL_STATE, '5')
    expect(next.display).toBe('5')
  })

  it('appends digit to display', () => {
    const state = { ...INITIAL_STATE, display: '12' }
    expect(reduceKeyPress(state, '3').display).toBe('123')
  })

  it('adds decimal point', () => {
    const state = { ...INITIAL_STATE, display: '12' }
    expect(reduceKeyPress(state, '.').display).toBe('12.')
  })

  it('prevents duplicate decimal', () => {
    const state = { ...INITIAL_STATE, display: '12.5' }
    expect(reduceKeyPress(state, '.').display).toBe('12.5')
  })

  it('starts fresh after result', () => {
    const state = { ...INITIAL_STATE, display: '42', result: 42 }
    expect(reduceKeyPress(state, '7').display).toBe('7')
  })

  it('handles leading decimal after result', () => {
    const state = { ...INITIAL_STATE, display: '42', result: 42 }
    expect(reduceKeyPress(state, '.').display).toBe('0.')
  })
})

// ─── reduceOperator ───────────────────────────────────────────────────────────

describe('reduceOperator', () => {
  it('appends operator to display', () => {
    const state = { ...INITIAL_STATE, display: '5' }
    expect(reduceOperator(state, '+').display).toBe('5+')
  })

  it('replaces trailing operator', () => {
    const state = { ...INITIAL_STATE, display: '5+' }
    expect(reduceOperator(state, '-').display).toBe('5-')
  })
})

// ─── reduceEquals ─────────────────────────────────────────────────────────────

describe('reduceEquals', () => {
  it('evaluates simple addition', () => {
    const state = { ...INITIAL_STATE, display: '2+3' }
    const next = reduceEquals(state)
    expect(next.result).toBe(5)
    expect(next.display).toBe('5')
  })

  it('evaluates with operator precedence', () => {
    const state = { ...INITIAL_STATE, display: '2+3*4' }
    expect(reduceEquals(state).result).toBe(14)
  })

  it('adds to history', () => {
    const state = { ...INITIAL_STATE, display: '10+5' }
    const next = reduceEquals(state)
    expect(next.history).toHaveLength(1)
    expect(next.history[0].result).toBe(15)
  })

  it('accumulates grand total', () => {
    let state = { ...INITIAL_STATE, display: '100' }
    state = reduceEquals(state)
    expect(state.grandTotal).toBe(100)
    state = { ...state, display: '50', result: null }
    state = reduceEquals(state)
    expect(state.grandTotal).toBe(150)
  })

  it('does nothing if display ends with operator', () => {
    const state = { ...INITIAL_STATE, display: '5+' }
    expect(reduceEquals(state)).toBe(state)
  })

  it('handles GST mode (exclusive)', () => {
    const state = { ...INITIAL_STATE, display: '1000', mode: 'gst' as const, gstRate: 18, gstMode: 'exclusive' as const }
    const next = reduceEquals(state)
    expect(next.result).toBe(1180)
    expect(next.lastGstBreakdown).toBeTruthy()
    expect(next.lastGstBreakdown!.base).toBe(1000)
    expect(next.lastGstBreakdown!.gst).toBe(180)
  })

  it('handles MU mode', () => {
    // MU: cost=100, enter margin 20% → selling price = 125
    const state = { ...INITIAL_STATE, display: '20', muBase: 100 }
    const next = reduceEquals(state)
    expect(next.result).toBe(125)
    expect(next.muBase).toBeNull()
  })
})

// ─── reduceClear ──────────────────────────────────────────────────────────────

describe('reduceClear', () => {
  it('resets display but preserves mode and history', () => {
    const state = {
      ...INITIAL_STATE,
      display: '123',
      mode: 'gst' as const,
      gstRate: 12,
      grandTotal: 500,
      history: [{ expression: '5', result: 5 }],
    }
    const next = reduceClear(state)
    expect(next.display).toBe('0')
    expect(next.result).toBeNull()
    expect(next.mode).toBe('gst')
    expect(next.gstRate).toBe(12)
    expect(next.grandTotal).toBe(500)
    expect(next.history).toHaveLength(1)
  })
})

// ─── reduceBackspace ──────────────────────────────────────────────────────────

describe('reduceBackspace', () => {
  it('removes last character', () => {
    const state = { ...INITIAL_STATE, display: '123' }
    expect(reduceBackspace(state).display).toBe('12')
  })

  it('resets to 0 when one char left', () => {
    const state = { ...INITIAL_STATE, display: '5' }
    expect(reduceBackspace(state).display).toBe('0')
  })

  it('clears after result', () => {
    const state = { ...INITIAL_STATE, display: '42', result: 42 }
    const next = reduceBackspace(state)
    expect(next.display).toBe('0')
    expect(next.result).toBeNull()
  })
})

// ─── reducePercent ────────────────────────────────────────────────────────────

describe('reducePercent', () => {
  it('appends % to display', () => {
    const state = { ...INITIAL_STATE, display: '100+18' }
    expect(reducePercent(state).display).toBe('100+18%')
  })

  it('does nothing if already has %', () => {
    const state = { ...INITIAL_STATE, display: '100+18%' }
    expect(reducePercent(state).display).toBe('100+18%')
  })

  it('does nothing if ends with operator', () => {
    const state = { ...INITIAL_STATE, display: '100+' }
    expect(reducePercent(state)).toBe(state)
  })
})

// ─── reduceSetGstRate / reduceToggleGstMode ───────────────────────────────────

describe('reduceSetGstRate', () => {
  it('sets GST rate and switches to GST mode', () => {
    const next = reduceSetGstRate(INITIAL_STATE, 12)
    expect(next.gstRate).toBe(12)
    expect(next.mode).toBe('gst')
  })
})

describe('reduceToggleGstMode', () => {
  it('toggles exclusive → inclusive', () => {
    expect(reduceToggleGstMode(INITIAL_STATE).gstMode).toBe('inclusive')
  })

  it('toggles inclusive → exclusive', () => {
    const state = { ...INITIAL_STATE, gstMode: 'inclusive' as const }
    expect(reduceToggleGstMode(state).gstMode).toBe('exclusive')
  })
})

// ─── reduceGT ─────────────────────────────────────────────────────────────────

describe('reduceGT', () => {
  it('shows grand total', () => {
    const state = { ...INITIAL_STATE, grandTotal: 1500 }
    const next = reduceGT(state)
    expect(next.display).toBe('1500')
    expect(next.result).toBe(1500)
  })
})

// ─── reduceMU ─────────────────────────────────────────────────────────────────

describe('reduceMU', () => {
  it('stores current value as MU base', () => {
    const state = { ...INITIAL_STATE, display: '100' }
    const next = reduceMU(state)
    expect(next.muBase).toBe(100)
    expect(next.display).toBe('0')
  })

  it('does nothing for zero', () => {
    expect(reduceMU(INITIAL_STATE)).toBe(INITIAL_STATE)
  })
})

// ─── reducePercentPreset ──────────────────────────────────────────────────────

describe('reducePercentPreset', () => {
  it('adds percentage to value', () => {
    const state = { ...INITIAL_STATE, display: '1000', result: 1000 }
    const next = reducePercentPreset(state, 18, 'add')
    expect(next.result).toBe(1180)
  })

  it('subtracts percentage from value', () => {
    const state = { ...INITIAL_STATE, display: '1000', result: 1000 }
    const next = reducePercentPreset(state, 10, 'subtract')
    expect(next.result).toBe(900)
  })

  it('does nothing for zero value', () => {
    expect(reducePercentPreset(INITIAL_STATE, 10, 'add')).toBe(INITIAL_STATE)
  })
})

// ─── reduceGstPreset ──────────────────────────────────────────────────────────

describe('reduceGstPreset', () => {
  it('adds GST to value (exclusive)', () => {
    const state = { ...INITIAL_STATE, display: '1000', result: 1000, gstRate: 18 }
    const next = reduceGstPreset(state, 'add')
    expect(next.result).toBe(1180)
    expect(next.lastGstBreakdown).toBeTruthy()
  })

  it('extracts GST from value (inclusive)', () => {
    const state = { ...INITIAL_STATE, display: '1180', result: 1180, gstRate: 18 }
    const next = reduceGstPreset(state, 'subtract')
    expect(next.result).toBe(1000)
  })
})
