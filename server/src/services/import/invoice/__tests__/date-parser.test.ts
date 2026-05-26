import { describe, expect, it } from 'vitest'
import { parseInvoiceDate } from '../date-parser.util.js'

describe('parseInvoiceDate', () => {
  // ── Happy paths — one per supported format ─────────────────────────
  it('accepts ISO YYYY-MM-DD', () => {
    expect(parseInvoiceDate('2025-03-15')).toEqual({ ok: true, iso: '2025-03-15' })
  })

  it('accepts DD/MM/YYYY (Indian)', () => {
    expect(parseInvoiceDate('15/03/2025')).toEqual({ ok: true, iso: '2025-03-15' })
  })

  it('accepts DD-MM-YYYY (Indian dash)', () => {
    expect(parseInvoiceDate('15-03-2025')).toEqual({ ok: true, iso: '2025-03-15' })
  })

  it('accepts DD-Mon-YYYY (Tally)', () => {
    expect(parseInvoiceDate('15-Mar-2025')).toEqual({ ok: true, iso: '2025-03-15' })
  })

  it('accepts DD MMM YYYY (space-separated)', () => {
    expect(parseInvoiceDate('15 March 2025')).toEqual({ ok: true, iso: '2025-03-15' })
  })

  it('case-insensitive month name', () => {
    expect(parseInvoiceDate('15-MAR-2025')).toEqual({ ok: true, iso: '2025-03-15' })
  })

  it('strips trailing time HH:MM', () => {
    expect(parseInvoiceDate('15-03-2025 14:30')).toEqual({ ok: true, iso: '2025-03-15' })
  })

  // ── NFKC happy + injection ─────────────────────────────────────────
  it('rejects devanagari numerals (NFKC does NOT fold them — anti-DoS)', () => {
    // SCOPE L102: NFKC-normalise + if non-ASCII digit remains → ERROR
    const devanagari = '१५/०३/२०२५'
    expect(parseInvoiceDate(devanagari)).toEqual({ ok: false, code: 'INVALID_DATE' })
  })

  it('rejects bidi-override (RTL-marker) injection', () => {
    expect(parseInvoiceDate('‮15/03/2025')).toEqual({
      ok: false, code: 'INVALID_DATE',
    })
  })

  it('rejects mixed-script after NFKC (CJK ideographic comma)', () => {
    expect(parseInvoiceDate('15・03・2025')).toEqual({
      ok: false, code: 'INVALID_DATE',
    })
  })

  // ── Length cap ─────────────────────────────────────────────────────
  it('rejects 33-char overlong input', () => {
    const long = '15/03/2025' + 'A'.repeat(30)
    expect(parseInvoiceDate(long)).toEqual({ ok: false, code: 'INVALID_DATE' })
  })

  // ── Semantic rejections ────────────────────────────────────────────
  it('rejects ambiguous MM/DD/YYYY by treating 03/15/2025 as DD/MM → invalid day', () => {
    // Indian convention: 03/15/2025 = day 3, month 15 → invalid month.
    expect(parseInvoiceDate('03/15/2025')).toEqual({ ok: false, code: 'INVALID_DATE' })
  })

  it('rejects invalid month name', () => {
    expect(parseInvoiceDate('15-Foo-2025')).toEqual({ ok: false, code: 'INVALID_DATE' })
  })

  it('rejects year < 1970', () => {
    expect(parseInvoiceDate('01/01/1969')).toEqual({ ok: false, code: 'INVALID_DATE' })
  })

  it('rejects year > 2100', () => {
    expect(parseInvoiceDate('01/01/2101')).toEqual({ ok: false, code: 'INVALID_DATE' })
  })

  it('rejects feb 29 in non-leap year', () => {
    expect(parseInvoiceDate('29/02/2023')).toEqual({ ok: false, code: 'INVALID_DATE' })
  })

  it('accepts feb 29 in leap year 2024', () => {
    expect(parseInvoiceDate('29/02/2024')).toEqual({ ok: true, iso: '2024-02-29' })
  })

  it('rejects empty string', () => {
    expect(parseInvoiceDate('')).toEqual({ ok: false, code: 'INVALID_DATE' })
  })

  it('rejects non-string input', () => {
    expect(parseInvoiceDate(null)).toEqual({ ok: false, code: 'INVALID_DATE' })
    expect(parseInvoiceDate(12345)).toEqual({ ok: false, code: 'INVALID_DATE' })
    expect(parseInvoiceDate(undefined)).toEqual({ ok: false, code: 'INVALID_DATE' })
  })

  it('rejects garbage punctuation', () => {
    expect(parseInvoiceDate('15.03.2025')).toEqual({ ok: false, code: 'INVALID_DATE' })
  })
})
