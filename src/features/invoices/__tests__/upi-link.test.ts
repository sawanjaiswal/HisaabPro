/**
 * Tests for src/lib/upi.ts — UPI deep-link builder (frontend)
 *
 * Covers:
 *  - Valid VPA produces correct URI
 *  - Invalid VPA returns null
 *  - amount=0 omits `am` param
 *  - Special chars in payeeName + txnNote are URL-encoded
 *  - Paise → rupees conversion correctness (no floating-point drift)
 *  - Amounts in paise that produce non-trivial rupee/paise combos
 */

import { describe, it, expect } from 'vitest'
import { buildUpiLink, isValidVpa } from '@/lib/upi'

describe('isValidVpa', () => {
  it('accepts standard VPA formats', () => {
    expect(isValidVpa('user@okhdfcbank')).toBe(true)
    expect(isValidVpa('raj.shop@ybl')).toBe(true)
    expect(isValidVpa('user-name@icici')).toBe(true)
    expect(isValidVpa('user_name@paytm')).toBe(true)
    expect(isValidVpa('ab@ok')).toBe(true) // 2-char handle
  })

  it('rejects invalid VPA formats', () => {
    expect(isValidVpa('')).toBe(false)
    expect(isValidVpa('@okhdfcbank')).toBe(false)         // no handle
    expect(isValidVpa('user@')).toBe(false)               // no bank
    expect(isValidVpa('a@ok')).toBe(false)                // handle too short
    expect(isValidVpa('user@ok-bank')).toBe(false)        // hyphen in bank
    expect(isValidVpa('user@1bank')).toBe(false)          // bank starts with digit
    expect(isValidVpa('user name@bank')).toBe(false)      // space in handle
  })
})

describe('buildUpiLink', () => {
  it('produces correct URI for a standard invoice payment', () => {
    const link = buildUpiLink({
      payeeVpa: 'raju@okhdfcbank',
      payeeName: 'Raju Shop',
      amountPaise: 120000, // ₹1,200.00
      transactionRef: 'INV-001',
      transactionNote: 'Invoice INV-001',
    })

    expect(link).not.toBeNull()
    const url = new URL(link!)
    expect(url.protocol).toBe('upi:')
    expect(url.hostname).toBe('pay')
    expect(url.searchParams.get('pa')).toBe('raju@okhdfcbank')
    expect(url.searchParams.get('pn')).toBe('Raju Shop')
    expect(url.searchParams.get('am')).toBe('1200.00')
    expect(url.searchParams.get('tr')).toBe('INV-001')
    expect(url.searchParams.get('tn')).toBe('Invoice INV-001')
    expect(url.searchParams.get('cu')).toBe('INR')
  })

  it('omits `am` param when amountPaise is 0', () => {
    const link = buildUpiLink({
      payeeVpa: 'raju@okhdfcbank',
      payeeName: 'Raju',
      amountPaise: 0,
    })
    expect(link).not.toBeNull()
    const url = new URL(link!)
    expect(url.searchParams.has('am')).toBe(false)
  })

  it('omits `am` param when amountPaise is omitted', () => {
    const link = buildUpiLink({
      payeeVpa: 'raju@okhdfcbank',
      payeeName: 'Raju',
    })
    expect(link).not.toBeNull()
    const url = new URL(link!)
    expect(url.searchParams.has('am')).toBe(false)
  })

  it('returns null for an invalid VPA', () => {
    const link = buildUpiLink({
      payeeVpa: 'notavpa',
      payeeName: 'Raju',
      amountPaise: 10000,
    })
    expect(link).toBeNull()
  })

  it('URL-encodes special chars in payeeName', () => {
    const link = buildUpiLink({
      payeeVpa: 'raju@okhdfcbank',
      payeeName: 'Raju & Sons',
      amountPaise: 50000,
    })
    expect(link).not.toBeNull()
    // URLSearchParams encodes & as %26 (or +)
    expect(link!.includes('Raju+%26+Sons') || link!.includes('Raju+%2526+Sons') || link!.includes('Raju') && link!.includes('Sons')).toBe(true)
    // Ensure the parsed value round-trips correctly
    const url = new URL(link!)
    expect(url.searchParams.get('pn')).toBe('Raju & Sons')
  })

  it('URL-encodes special chars in transactionNote', () => {
    const link = buildUpiLink({
      payeeVpa: 'raju@okhdfcbank',
      payeeName: 'Raju',
      amountPaise: 10000,
      transactionNote: 'Bill #001 / GST inclusive',
    })
    expect(link).not.toBeNull()
    const url = new URL(link!)
    expect(url.searchParams.get('tn')).toBe('Bill #001 / GST inclusive')
  })

  it('correctly converts edge-case paise values', () => {
    // ₹1 = 100 paise
    const link1 = buildUpiLink({ payeeVpa: 'ab@ok', payeeName: 'T', amountPaise: 100 })
    expect(new URL(link1!).searchParams.get('am')).toBe('1.00')

    // ₹0.01 = 1 paise (edge)
    const link2 = buildUpiLink({ payeeVpa: 'ab@ok', payeeName: 'T', amountPaise: 1 })
    expect(new URL(link2!).searchParams.get('am')).toBe('0.01')

    // ₹1,000.50 = 100050 paise
    const link3 = buildUpiLink({ payeeVpa: 'ab@ok', payeeName: 'T', amountPaise: 100050 })
    expect(new URL(link3!).searchParams.get('am')).toBe('1000.50')
  })

  it('truncates transactionNote at 80 chars', () => {
    const longNote = 'A'.repeat(100)
    const link = buildUpiLink({ payeeVpa: 'ab@ok', payeeName: 'T', transactionNote: longNote })
    const url = new URL(link!)
    expect((url.searchParams.get('tn') ?? '').length).toBeLessThanOrEqual(80)
  })
})
