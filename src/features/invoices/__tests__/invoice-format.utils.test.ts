import { describe, it, expect } from 'vitest'
import {
  formatInvoiceAmount,
  paiseToRupees,
  rupeesToPaise,
} from '../invoice-format.utils'

// ─── Paise helpers ───────────────────────────────────────────────────────────

describe('paiseToRupees / rupeesToPaise', () => {
  it('converts paise to rupees', () => {
    expect(paiseToRupees(15500)).toBe(155)
  })

  it('converts rupees to paise', () => {
    expect(rupeesToPaise(155)).toBe(15500)
  })

  it('handles floating-point drift', () => {
    // 149.99 * 100 = 14998.999... → Math.round → 14999
    expect(rupeesToPaise(149.99)).toBe(14999)
  })
})

// ─── Format amount ───────────────────────────────────────────────────────────

describe('formatInvoiceAmount', () => {
  it('formats paise as INR', () => {
    const result = formatInvoiceAmount(1550000)
    expect(result).toContain('15,500.00')
  })

  it('formats zero', () => {
    const result = formatInvoiceAmount(0)
    expect(result).toContain('0.00')
  })
})
