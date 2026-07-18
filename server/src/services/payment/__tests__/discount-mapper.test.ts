/**
 * mapPaymentDiscount — derives the API `value` from the split DB columns.
 *
 * Regression guard for the "Unknown field `value` on PaymentDiscount" 500:
 * the DB stores valuePaise XOR percentBps; the client contract exposes a single
 * `value` (0-100 for PERCENTAGE, paise for FIXED).
 */
import { describe, it, expect } from 'vitest'
import { mapPaymentDiscount } from '../selects.js'

describe('mapPaymentDiscount', () => {
  it('returns null when there is no discount', () => {
    expect(mapPaymentDiscount(null)).toBeNull()
  })

  it('maps a FIXED discount to value = valuePaise', () => {
    const out = mapPaymentDiscount({
      id: 'd1', type: 'FIXED', valuePaise: 5000, percentBps: null,
      calculatedAmount: 5000, reason: 'loyalty',
    })
    expect(out).toEqual({ id: 'd1', type: 'FIXED', value: 5000, calculatedAmount: 5000, reason: 'loyalty' })
  })

  it('maps a PERCENTAGE discount to value = percentBps / 100', () => {
    const out = mapPaymentDiscount({
      id: 'd2', type: 'PERCENTAGE', valuePaise: null, percentBps: 1000,
      calculatedAmount: 2000, reason: null,
    })
    expect(out).toEqual({ id: 'd2', type: 'PERCENTAGE', value: 10, calculatedAmount: 2000, reason: null })
  })
})
