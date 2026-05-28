import { describe, it, expect } from 'vitest'
import {
  parseVoiceEntry, parseAmountRupees, parseWordNumber,
  detectIntent, detectPaymentMode, detectDateISO, guessIncomeCategory,
} from '../voice.parser'
import { toLocalISODate } from '@/lib/format'

const NOW = new Date('2026-05-28T10:00:00')

describe('parseAmountRupees', () => {
  it('parses plain digits', () => {
    expect(parseAmountRupees('500')).toBe(500)
  })
  it('strips currency words and symbols', () => {
    expect(parseAmountRupees('₹500')).toBe(500)
    expect(parseAmountRupees('rs 250')).toBe(250)
    expect(parseAmountRupees('1500 rupees')).toBe(1500)
  })
  it('removes thousands commas', () => {
    expect(parseAmountRupees('1,500')).toBe(1500)
  })
  it('applies scale words after digits', () => {
    expect(parseAmountRupees('2 hazaar')).toBe(2000)
    expect(parseAmountRupees('1.5 lakh')).toBe(150000)
    expect(parseAmountRupees('1 crore')).toBe(10000000)
  })
  it('returns null when no number present', () => {
    expect(parseAmountRupees('paid for tea')).toBeNull()
  })
})

describe('parseWordNumber', () => {
  it('combines units and scales', () => {
    expect(parseWordNumber('do hazaar paanch sau')).toBe(2500)
    expect(parseWordNumber('ek hazaar')).toBe(1000)
    expect(parseWordNumber('paanch sau')).toBe(500)
  })
  it('handles fractional prefixes', () => {
    expect(parseWordNumber('dhai hazaar')).toBe(2500)
    expect(parseWordNumber('dedh lakh')).toBe(150000)
  })
  it('returns null for no number words', () => {
    expect(parseWordNumber('rent received')).toBeNull()
  })
})

describe('detectIntent', () => {
  it('detects income explicitly', () => {
    expect(detectIntent('rent mila 5000')).toEqual({ intent: 'income', explicit: true })
  })
  it('detects expense explicitly', () => {
    expect(detectIntent('chai pe kharch 50')).toEqual({ intent: 'expense', explicit: true })
  })
  it('defaults to expense when ambiguous', () => {
    expect(detectIntent('500 cash')).toEqual({ intent: 'expense', explicit: false })
  })
})

describe('detectPaymentMode', () => {
  it('detects UPI variants', () => {
    expect(detectPaymentMode('paid 500 via phonepe').mode).toBe('UPI')
    expect(detectPaymentMode('gpay 200').mode).toBe('UPI')
  })
  it('detects cheque before bank', () => {
    expect(detectPaymentMode('cheque payment 1000').mode).toBe('CHEQUE')
  })
  it('defaults to cash', () => {
    expect(detectPaymentMode('spent 50')).toEqual({ mode: 'CASH', explicit: false })
  })
})

describe('guessIncomeCategory', () => {
  it('maps known income categories', () => {
    expect(guessIncomeCategory('byaj ka paisa aaya')).toBe('Interest')
    expect(guessIncomeCategory('shop rent received')).toBe('Rental')
  })
  it('returns null for unknown', () => {
    expect(guessIncomeCategory('paisa aaya')).toBeNull()
  })
})

describe('detectDateISO', () => {
  it('returns today by default', () => {
    expect(detectDateISO('spent 500', NOW)).toBe(toLocalISODate(NOW))
  })
  it('resolves yesterday/kal to -1 day', () => {
    expect(detectDateISO('kal 500 kharch', NOW)).toBe(toLocalISODate(new Date('2026-05-27T10:00:00')))
  })
})

describe('parseVoiceEntry', () => {
  it('parses a full expense sentence', () => {
    const r = parseVoiceEntry('chai pe 50 rupees cash kharch', NOW)
    expect(r.intent).toBe('expense')
    expect(r.amountPaise).toBe(5000)
    expect(r.paymentMode).toBe('CASH')
    expect(r.dateISO).toBe(toLocalISODate(NOW))
    expect(r.confidence).toBeGreaterThan(0.5)
  })
  it('parses a full income sentence with category', () => {
    const r = parseVoiceEntry('rent mila 5000 upi', NOW)
    expect(r.intent).toBe('income')
    expect(r.amountPaise).toBe(500000)
    expect(r.paymentMode).toBe('UPI')
    expect(r.category).toBe('Rental')
  })
  it('returns null amount and low confidence when unparseable', () => {
    const r = parseVoiceEntry('hello there', NOW)
    expect(r.amountPaise).toBeNull()
    expect(r.confidence).toBeLessThan(0.5)
  })
  it('preserves the raw transcript as notes', () => {
    expect(parseVoiceEntry('  bought stock 1200  ', NOW).notes).toBe('bought stock 1200')
  })
})
