import { describe, it, expect } from 'vitest'
import { parsePaiseBigInt, roundFracStringTo2dp } from '../utils/price.util.js'

describe('parsePaiseBigInt — 7-row boundary suite (SCOPE L330-338)', () => {
  it('happy path "100.50" → 10050n', () => {
    expect(parsePaiseBigInt('100.50')).toEqual({ value: 10050n })
  })

  it('zero "0" → 0n', () => {
    expect(parsePaiseBigInt('0')).toEqual({ value: 0n })
  })

  it('zero with frac "0.00" → 0n', () => {
    expect(parsePaiseBigInt('0.00')).toEqual({ value: 0n })
  })

  it('comma-grouped "1,23,456.78" → 12345678n', () => {
    expect(parsePaiseBigInt('1,23,456.78')).toEqual({ value: 12345678n })
  })

  it('precision-lost "100.999" → 10100n + PRICE_PRECISION_LOST', () => {
    const r = parsePaiseBigInt('100.999')
    expect(r.value).toBe(10100n)
    expect(r.issue).toBe('PRICE_PRECISION_LOST')
  })

  it('precision-lost down "100.991" → 10099n + PRICE_PRECISION_LOST', () => {
    const r = parsePaiseBigInt('100.991')
    expect(r.value).toBe(10099n)
    expect(r.issue).toBe('PRICE_PRECISION_LOST')
  })

  it('overflow >12 int digits → PRICE_OUT_OF_RANGE', () => {
    const r = parsePaiseBigInt('1234567890123')
    expect(r.value).toBeNull()
    expect(r.issue).toBe('PRICE_OUT_OF_RANGE')
  })

  it('malformed alpha "abc" → PRICE_INVALID', () => {
    const r = parsePaiseBigInt('abc')
    expect(r.value).toBeNull()
    expect(r.issue).toBe('PRICE_INVALID')
  })

  it('empty "" → PRICE_INVALID', () => {
    expect(parsePaiseBigInt('').issue).toBe('PRICE_INVALID')
  })

  it('null/undefined → PRICE_INVALID', () => {
    expect(parsePaiseBigInt(null).issue).toBe('PRICE_INVALID')
    expect(parsePaiseBigInt(undefined).issue).toBe('PRICE_INVALID')
  })

  it('no parseFloat float-drift: "0.1" → 10n exactly', () => {
    expect(parsePaiseBigInt('0.1').value).toBe(10n)
  })
})

describe('roundFracStringTo2dp', () => {
  it('pads short frac', () => {
    expect(roundFracStringTo2dp('5')).toBe('50')
    expect(roundFracStringTo2dp('')).toBe('00')
  })
  it('rounds down when third digit <5', () => {
    expect(roundFracStringTo2dp('124')).toBe('12')
  })
  it('rounds up when third digit >=5', () => {
    expect(roundFracStringTo2dp('125')).toBe('13')
    expect(roundFracStringTo2dp('999')).toBe('100') // overflow signal
  })
})
