import { describe, expect, it } from 'vitest'
import { narrowPaiseToInt } from '../amount-narrow.util.js'
import { AMOUNT_MAX } from '../invoice.constants.js'

describe('narrowPaiseToInt', () => {
  it('narrows 0n cleanly', () => {
    expect(narrowPaiseToInt(0n)).toEqual({ ok: true, value: 0 })
  })

  it('narrows a small positive', () => {
    expect(narrowPaiseToInt(11800n)).toEqual({ ok: true, value: 11800 })
  })

  it('narrows AMOUNT_MAX boundary', () => {
    const r = narrowPaiseToInt(AMOUNT_MAX)
    expect(r).toEqual({ ok: true, value: Number(AMOUNT_MAX) })
  })

  it('rejects 1 paise above AMOUNT_MAX with AMOUNT_OUT_OF_RANGE', () => {
    expect(narrowPaiseToInt(AMOUNT_MAX + 1n)).toEqual({
      ok: false, code: 'AMOUNT_OUT_OF_RANGE',
    })
  })

  it('rejects negatives with AMOUNT_NEGATIVE', () => {
    expect(narrowPaiseToInt(-1n)).toEqual({ ok: false, code: 'AMOUNT_NEGATIVE' })
  })

  it('rejects deeply negative with AMOUNT_NEGATIVE not OUT_OF_RANGE', () => {
    expect(narrowPaiseToInt(-9999999999999999999n)).toEqual({
      ok: false, code: 'AMOUNT_NEGATIVE',
    })
  })
})
