import { describe, it, expect } from 'vitest'
import { validateBarcode, getBarcodeHint } from '../barcode.utils'

// ─── validateBarcode ──────────────────────────────────────────────────────────

describe('validateBarcode', () => {
  it('returns null for empty value (optional field)', () => {
    expect(validateBarcode('', 'CODE128')).toBeNull()
    expect(validateBarcode('  ', 'CODE128')).toBeNull()
  })

  it('validates CODE128 (printable ASCII)', () => {
    expect(validateBarcode('ABC123', 'CODE128')).toBeNull()
    expect(validateBarcode('Hello World!', 'CODE128')).toBeNull()
  })

  it('validates EAN13 format', () => {
    // Valid EAN13 with correct check digit
    expect(validateBarcode('4006381333931', 'EAN13')).toBeNull()
  })

  it('rejects invalid EAN13 check digit', () => {
    expect(validateBarcode('4006381333930', 'EAN13')).toBe('Invalid check digit')
  })

  it('rejects wrong-length EAN13', () => {
    expect(validateBarcode('12345', 'EAN13')).toMatch(/Invalid for EAN13/)
  })

  it('validates EAN8 format', () => {
    expect(validateBarcode('96385074', 'EAN8')).toBeNull()
  })

  it('rejects invalid EAN8 check digit', () => {
    expect(validateBarcode('96385071', 'EAN8')).toBe('Invalid check digit')
  })

  it('validates UPC format', () => {
    expect(validateBarcode('012345678905', 'UPC')).toBeNull()
  })

  it('validates CODE39 (uppercase + digits + special)', () => {
    expect(validateBarcode('ITEM-001', 'CODE39')).toBeNull()
  })

  it('rejects lowercase in CODE39', () => {
    expect(validateBarcode('item-001', 'CODE39')).toMatch(/Invalid for CODE39/)
  })

  it('rejects barcode exceeding max length', () => {
    const long = 'A'.repeat(200)
    expect(validateBarcode(long, 'CODE128')).toMatch(/too long/)
  })
})

// ─── getBarcodeHint ───────────────────────────────────────────────────────────

describe('getBarcodeHint', () => {
  it('returns hint for each format', () => {
    expect(getBarcodeHint('CODE128')).toBeTruthy()
    expect(getBarcodeHint('EAN13')).toContain('13 digits')
    expect(getBarcodeHint('EAN8')).toContain('8 digits')
    expect(getBarcodeHint('UPC')).toContain('12 digits')
    expect(getBarcodeHint('CODE39')).toContain('Uppercase')
  })
})
