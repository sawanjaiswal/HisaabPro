import { describe, it, expect } from 'vitest'
import { resolveUnit } from '../utils/unit-resolver.js'

describe('resolveUnit — alias coverage', () => {
  it('happy lowercase "pcs" → pcs', () => {
    expect(resolveUnit('pcs').unit).toBe('pcs')
  })

  it('case-fold uppercase "PCS" → pcs', () => {
    expect(resolveUnit('PCS').unit).toBe('pcs')
  })

  it('trailing dot "Pcs." → pcs', () => {
    expect(resolveUnit('Pcs.').unit).toBe('pcs')
  })

  it('trailing space "Pcs " → pcs', () => {
    expect(resolveUnit('Pcs ').unit).toBe('pcs')
  })

  it('plural "pieces" → pcs', () => {
    expect(resolveUnit('pieces').unit).toBe('pcs')
  })

  it('NFKC fullwidth "Ｐｃｓ" → pcs', () => {
    expect(resolveUnit('Ｐｃｓ').unit).toBe('pcs')
  })

  it('devanagari "नग" → pcs', () => {
    expect(resolveUnit('नग').unit).toBe('pcs')
  })

  it('devanagari "किलो" → kg', () => {
    expect(resolveUnit('किलो').unit).toBe('kg')
  })

  it('devanagari "ग्राम" → g', () => {
    expect(resolveUnit('ग्राम').unit).toBe('g')
  })

  it('devanagari "लीटर" → l', () => {
    expect(resolveUnit('लीटर').unit).toBe('l')
  })

  it('plurals "liters" / "litres" / "kilos" → l/l/kg', () => {
    expect(resolveUnit('liters').unit).toBe('l')
    expect(resolveUnit('litres').unit).toBe('l')
    expect(resolveUnit('kilos').unit).toBe('kg')
  })

  it('bidi-strip "‮pcs" (RLO prefix) → pcs', () => {
    expect(resolveUnit('‮pcs').unit).toBe('pcs')
  })

  it('"no" deliberately NOT resolved → UNIT_NOT_FOUND', () => {
    const r = resolveUnit('no')
    expect(r.unit).toBeNull()
    expect(r.issue).toBe('UNIT_NOT_FOUND')
  })

  it('unknown "doz" (not "dozen") → UNIT_NOT_FOUND', () => {
    expect(resolveUnit('doz').issue).toBe('UNIT_NOT_FOUND')
  })

  it('max-len overflow: 200 chars truncates and still tries to match', () => {
    const r = resolveUnit('p'.repeat(200))
    expect(r.unit).toBeNull()
  })

  it('empty/null → UNIT_INVALID', () => {
    expect(resolveUnit('').issue).toBe('UNIT_INVALID')
    expect(resolveUnit(null).issue).toBe('UNIT_INVALID')
    expect(resolveUnit(undefined).issue).toBe('UNIT_INVALID')
  })

  it('preserves unitSourceText on UNIT_NOT_FOUND for FE deep-link', () => {
    const r = resolveUnit('  Roll  ')
    expect(r.unitSourceText).toBe('Roll')
  })
})
