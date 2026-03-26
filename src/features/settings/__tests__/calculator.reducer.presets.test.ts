import { describe, it, expect } from 'vitest'
import {
  INITIAL_STATE,
  reduceSetGstRate,
  reduceToggleGstMode,
  reduceGT,
  reduceMU,
  reducePercentPreset,
  reduceGstPreset,
} from '../calculator.reducer'

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
