/**
 * M13 (SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md §1) — Tally 8-digit DATE
 * pre-format MUST calendar-validate. Plus tail-100 reference
 * truncation (cleared S3).
 */
import { describe, it, expect } from 'vitest'
import {
  truncateReference,
  tallyPreformatDate,
  REFERENCE_TRUNCATE_FROM,
} from '../normalizers/payment-utils.js'

describe('payment-utils · M13 Tally 8-digit DATE calendar guard', () => {
  it('valid 8-digit calendar → ISO', () => {
    expect(tallyPreformatDate('20250315')).toBe('2025-03-15')
    expect(tallyPreformatDate('20240229')).toBe('2024-02-29') // leap year
  })

  it('month > 12 → null (INVALID_DATE)', () => {
    expect(tallyPreformatDate('20251332')).toBe(null)
    expect(tallyPreformatDate('20251301')).toBe(null)
  })

  it('day > daysInMonth → null', () => {
    expect(tallyPreformatDate('20250230')).toBe(null) // Feb 30 — never valid
    expect(tallyPreformatDate('20230229')).toBe(null) // non-leap Feb 29
    expect(tallyPreformatDate('20250431')).toBe(null) // April 31
  })

  it('zeros → null', () => {
    expect(tallyPreformatDate('00000000')).toBe(null)
    expect(tallyPreformatDate('20250000')).toBe(null)
    expect(tallyPreformatDate('20250100')).toBe(null)
  })

  it('non-8-digit input passes through (shared parser handles)', () => {
    expect(tallyPreformatDate('2025-03-15')).toBe('2025-03-15')
    expect(tallyPreformatDate('15/03/2025')).toBe('15/03/2025')
    // Empty trimmed string is a pass-through; caller's shared parseInvoiceDate
    // converts it to INVALID_DATE.
    expect(tallyPreformatDate('')).toBe('')
  })

  it('non-string input → null', () => {
    expect(tallyPreformatDate(null)).toBe(null)
    expect(tallyPreformatDate(undefined)).toBe(null)
    expect(tallyPreformatDate(20250315)).toBe(null)
  })

  it('year out of [1900, 2999] → null', () => {
    expect(tallyPreformatDate('18991231')).toBe(null)
    expect(tallyPreformatDate('30000101')).toBe(null)
  })
})

describe('payment-utils · truncateReference (tail-100, cleared S3)', () => {
  it('SSOT — tail truncation direction', () => {
    expect(REFERENCE_TRUNCATE_FROM).toBe('tail')
  })

  it('null / empty / whitespace → null', () => {
    expect(truncateReference(null)).toBe(null)
    expect(truncateReference(undefined)).toBe(null)
    expect(truncateReference('')).toBe(null)
    expect(truncateReference('   ')).toBe(null)
  })

  it('short ref → not truncated', () => {
    expect(truncateReference('UTR123456789')).toEqual({
      value: 'UTR123456789',
      truncated: false,
    })
  })

  it('exactly 100 chars → not truncated', () => {
    const ref = 'a'.repeat(100)
    expect(truncateReference(ref)).toEqual({ value: ref, truncated: false })
  })

  it('150-char ref → keeps LAST 100 chars (tail), truncated=true', () => {
    const ref = 'PREFIX_' + 'x'.repeat(143)
    const r = truncateReference(ref)!
    expect(r.truncated).toBe(true)
    expect(r.value.length).toBe(100)
    expect(r.value).toBe(ref.slice(-100))
  })

  it('two 150-char refs differing only in last digit produce DISTINCT truncated values', () => {
    const a = 'a'.repeat(149) + '1'
    const b = 'a'.repeat(149) + '2'
    const ta = truncateReference(a)!
    const tb = truncateReference(b)!
    expect(ta.value).not.toBe(tb.value)
    expect(ta.value.endsWith('1')).toBe(true)
    expect(tb.value.endsWith('2')).toBe(true)
  })
})
