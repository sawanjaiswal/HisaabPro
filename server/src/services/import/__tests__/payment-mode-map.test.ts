/**
 * M12 (SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md §1) — prototype-pollution
 * defence on payment-mode lookup.
 *
 * Plus the dictionary-coverage tests called out in ARCHITECTURE
 * §7 pathology rows 5/6/7 and File Plan row 37.
 */
import { describe, it, expect } from 'vitest'
import { resolveMode, normaliseKey } from '../normalizers/payment-mode-map.js'
import { PAYMENT_MODE_MAP } from '../normalizers/payment-mode-map.constants.js'

describe('payment-mode-map · M12 prototype-pollution defence', () => {
  it('__proto__ resolves to OTHER+defaulted (non-strict) and rejects (strict)', () => {
    expect(resolveMode('__proto__', false)).toEqual({
      mode: 'OTHER',
      defaulted: true,
      unknown: true,
    })
    expect(resolveMode('__proto__', true)).toEqual({
      mode: null,
      defaulted: false,
      unknown: true,
    })
  })

  it('constructor resolves to OTHER+defaulted (non-strict) and rejects (strict)', () => {
    expect(resolveMode('constructor', false)).toEqual({
      mode: 'OTHER',
      defaulted: true,
      unknown: true,
    })
    expect(resolveMode('constructor', true)).toEqual({
      mode: null,
      defaulted: false,
      unknown: true,
    })
  })

  it('toString / hasOwnProperty / valueOf all route to OTHER (non-strict)', () => {
    for (const poison of ['toString', 'hasOwnProperty', 'valueOf', 'isPrototypeOf']) {
      const result = resolveMode(poison, false)
      expect(result.mode).toBe('OTHER')
      expect(result.unknown).toBe(true)
    }
  })

  it('PAYMENT_MODE_MAP.get(__proto__) returns undefined (not Object proto)', () => {
    expect(PAYMENT_MODE_MAP.get('__proto__')).toBeUndefined()
    expect(PAYMENT_MODE_MAP.get('constructor')).toBeUndefined()
  })
})

describe('payment-mode-map · normaliseKey', () => {
  it('NFKC + lc + trim + ws-collapse', () => {
    expect(normaliseKey('  Bank   Transfer  ')).toBe('bank transfer')
    expect(normaliseKey('NEFT')).toBe('neft')
  })
  it('returns null for empty / whitespace-only', () => {
    expect(normaliseKey('')).toBe(null)
    expect(normaliseKey('   ')).toBe(null)
  })
})

describe('payment-mode-map · dictionary hits (pathology rows 5-7)', () => {
  it('row 7: Devanagari "बैंक A/c " → BANK_TRANSFER (NFKC + lc + trim + ws)', () => {
    expect(resolveMode('बैंक A/c ', false).mode).toBe('BANK_TRANSFER')
  })

  it('row 5: unknown "Crypto" + strictMode=false → OTHER + defaulted', () => {
    const r = resolveMode('Crypto', false)
    expect(r).toEqual({ mode: 'OTHER', defaulted: true, unknown: true })
  })

  it('row 6: unknown "Crypto" + strictMode=true → mode=null (caller raises MODE_UNKNOWN_STRICT)', () => {
    const r = resolveMode('Crypto', true)
    expect(r).toEqual({ mode: null, defaulted: false, unknown: true })
  })

  it('casing + spacing variants — "  UPI  ", "upi", "Upi" all hit', () => {
    expect(resolveMode('  UPI  ', false).mode).toBe('UPI')
    expect(resolveMode('upi', false).mode).toBe('UPI')
    expect(resolveMode('Upi', false).mode).toBe('UPI')
  })

  it('Devanagari नकद / यूपीआई / चेक / अन्य all map to canonical modes', () => {
    expect(resolveMode('नकद', false).mode).toBe('CASH')
    expect(resolveMode('यूपीआई', false).mode).toBe('UPI')
    expect(resolveMode('चेक', false).mode).toBe('CHEQUE')
    expect(resolveMode('अन्य', false).mode).toBe('OTHER')
  })

  it('null / undefined / "" input is treated as unknown (non-strict → OTHER)', () => {
    expect(resolveMode(null, false).mode).toBe('OTHER')
    expect(resolveMode(undefined, false).mode).toBe('OTHER')
    expect(resolveMode('', false).mode).toBe('OTHER')
  })

  it('null / undefined / "" input is REJECTED under strictMode', () => {
    expect(resolveMode(null, true).mode).toBe(null)
    expect(resolveMode(undefined, true).mode).toBe(null)
    expect(resolveMode('', true).mode).toBe(null)
  })

  it('SQL-shaped string "DROP TABLE Payment" → OTHER (non-strict)', () => {
    expect(resolveMode('DROP TABLE Payment', false).mode).toBe('OTHER')
  })
})
