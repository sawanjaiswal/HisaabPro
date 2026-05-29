/**
 * Pure posting-map unit tests — the GL invariant is Σdebit === Σcredit for
 * EVERY source shape (S1, critique M4). These functions carry no DB; if a map
 * ever goes unbalanced the persistence layer throws at runtime, so we pin the
 * balance here where the failure is cheap and the worked example is readable.
 *
 * Ground-truth (document-calc.ts): grandTotal = subtotal + additionalCharges +
 * tax + roundOff, and does NOT include tds/tcs. Revenue posts from `subtotal`
 * (net of discount); AR = grandTotal − tds + tcs.
 */
import { describe, it, expect } from 'vitest'
import {
  mapSaleInvoice,
  mapPurchaseInvoice,
  mapDocument,
  mapPayment,
  mapExpense,
  type DocumentForPosting,
  type PaymentForPosting,
  type ExpenseForPosting,
} from './posting.maps.js'
import type { PostingMap } from './posting.types.js'

const sum = (m: PostingMap) => ({
  debit: m.lines.reduce((s, l) => s + l.debit, 0),
  credit: m.lines.reduce((s, l) => s + l.credit, 0),
})
const expectBalanced = (m: PostingMap) => {
  const { debit, credit } = sum(m)
  expect(debit).toBe(credit)
}
const codeAmt = (m: PostingMap, code: string, side: 'debit' | 'credit') =>
  m.lines.filter((l) => l.code === code).reduce((s, l) => s + l[side], 0)

const baseDoc = (over: Partial<DocumentForPosting> = {}): DocumentForPosting => ({
  type: 'SALE_INVOICE',
  partyId: 'party_1',
  subtotal: 0,
  totalAdditionalCharges: 0,
  roundOff: 0,
  grandTotal: 0,
  totalCgst: 0,
  totalSgst: 0,
  totalIgst: 0,
  totalCess: 0,
  tdsAmount: 0,
  tcsAmount: 0,
  totalCost: 0,
  ...over,
})

describe('mapSaleInvoice — balanced across tax regimes', () => {
  it('standard GST sale (CGST+SGST) with COGS', () => {
    // subtotal 10000, CGST 900 + SGST 900 = 1800 tax, grandTotal 11800
    const m = mapSaleInvoice(
      baseDoc({ subtotal: 10000, totalCgst: 900, totalSgst: 900, grandTotal: 11800, totalCost: 6000 }),
    )
    expectBalanced(m)
    expect(codeAmt(m, '1200', 'debit')).toBe(11800) // AR
    expect(codeAmt(m, '4000', 'credit')).toBe(10000) // revenue from subtotal
    expect(codeAmt(m, '2100', 'credit')).toBe(1800) // output tax
    expect(codeAmt(m, '5050', 'debit')).toBe(6000) // COGS
    expect(codeAmt(m, '1300', 'credit')).toBe(6000) // inventory out
  })

  it('composition scheme (no GST, totalTaxableValue would be 0)', () => {
    const m = mapSaleInvoice(baseDoc({ subtotal: 5000, grandTotal: 5000 }))
    expectBalanced(m)
    expect(codeAmt(m, '4000', 'credit')).toBe(5000)
    expect(codeAmt(m, '2100', 'credit')).toBe(0)
  })

  it('TDS deducted by customer reduces cash but not revenue', () => {
    // subtotal 100000, no tax, customer withholds TDS 2000 → AR 98000 + TDS Rcv 2000
    const m = mapSaleInvoice(baseDoc({ subtotal: 100000, grandTotal: 100000, tdsAmount: 2000 }))
    expectBalanced(m)
    expect(codeAmt(m, '1200', 'debit')).toBe(98000)
    expect(codeAmt(m, '1250', 'debit')).toBe(2000)
    expect(codeAmt(m, '4000', 'credit')).toBe(100000)
  })

  it('TCS collected adds to receivable and a payable', () => {
    const m = mapSaleInvoice(baseDoc({ subtotal: 100000, grandTotal: 100000, tcsAmount: 1000 }))
    expectBalanced(m)
    expect(codeAmt(m, '1200', 'debit')).toBe(101000)
    expect(codeAmt(m, '2300', 'credit')).toBe(1000)
  })

  it('positive and negative round-off both balance', () => {
    const up = mapSaleInvoice(baseDoc({ subtotal: 9999, grandTotal: 10000, roundOff: 1 }))
    expectBalanced(up)
    expect(codeAmt(up, '5400', 'credit')).toBe(1)
    const down = mapSaleInvoice(baseDoc({ subtotal: 10001, grandTotal: 10000, roundOff: -1 }))
    expectBalanced(down)
    expect(codeAmt(down, '5400', 'debit')).toBe(1)
  })

  it('additional charges post to other income', () => {
    const m = mapSaleInvoice(baseDoc({ subtotal: 10000, totalAdditionalCharges: 500, grandTotal: 10500 }))
    expectBalanced(m)
    expect(codeAmt(m, '4100', 'credit')).toBe(500)
  })
})

describe('mapPurchaseInvoice — balanced', () => {
  it('standard purchase with ITC', () => {
    const m = mapPurchaseInvoice(
      baseDoc({ type: 'PURCHASE_INVOICE', subtotal: 10000, totalIgst: 1800, grandTotal: 11800 }),
    )
    expectBalanced(m)
    expect(codeAmt(m, '1300', 'debit')).toBe(10000)
    expect(codeAmt(m, '2100', 'debit')).toBe(1800) // ITC
    expect(codeAmt(m, '2000', 'credit')).toBe(11800) // AP
  })

  it('purchase with TDS withheld from supplier', () => {
    const m = mapPurchaseInvoice(
      baseDoc({ type: 'PURCHASE_INVOICE', subtotal: 100000, grandTotal: 100000, tdsAmount: 5000 }),
    )
    expectBalanced(m)
    expect(codeAmt(m, '2000', 'credit')).toBe(95000)
    expect(codeAmt(m, '2200', 'credit')).toBe(5000)
  })
})

describe('mapDocument — credit/debit notes mirror their base invoice', () => {
  it('CREDIT_NOTE mirrors SALE legs (was debit → now credit)', () => {
    const base = baseDoc({ type: 'SALE_INVOICE', subtotal: 10000, totalCgst: 900, totalSgst: 900, grandTotal: 11800 })
    const cn = mapDocument({ ...base, type: 'CREDIT_NOTE' })
    expectBalanced(cn)
    expect(cn.type).toBe('CREDIT_NOTE')
    // AR was a debit on the sale → on the CN it is a credit
    expect(codeAmt(cn, '1200', 'credit')).toBe(11800)
    expect(codeAmt(cn, '4000', 'debit')).toBe(10000)
  })

  it('DEBIT_NOTE mirrors PURCHASE legs', () => {
    const base = baseDoc({ type: 'PURCHASE_INVOICE', subtotal: 10000, totalIgst: 1800, grandTotal: 11800 })
    const dn = mapDocument({ ...base, type: 'DEBIT_NOTE' })
    expectBalanced(dn)
    expect(dn.type).toBe('DEBIT_NOTE')
    expect(codeAmt(dn, '2000', 'debit')).toBe(11800)
  })

  it('non-postable type yields empty JOURNAL map', () => {
    const m = mapDocument(baseDoc({ type: 'ESTIMATE' }))
    expect(m.lines).toHaveLength(0)
  })
})

describe('mapPayment — receipt vs payment', () => {
  it('PAYMENT_IN cash → Dr Cash, Cr AR', () => {
    const p: PaymentForPosting = { type: 'PAYMENT_IN', mode: 'CASH', amount: 5000, partyId: 'p1' }
    const m = mapPayment(p)
    expectBalanced(m)
    expect(codeAmt(m, '1000', 'debit')).toBe(5000)
    expect(codeAmt(m, '1200', 'credit')).toBe(5000)
  })

  it('PAYMENT_IN UPI routes to Bank not Cash', () => {
    const m = mapPayment({ type: 'PAYMENT_IN', mode: 'UPI', amount: 5000, partyId: 'p1' })
    expectBalanced(m)
    expect(codeAmt(m, '1100', 'debit')).toBe(5000)
    expect(codeAmt(m, '1000', 'debit')).toBe(0)
  })

  it('PAYMENT_OUT → Dr AP, Cr Cash/Bank', () => {
    const m = mapPayment({ type: 'PAYMENT_OUT', mode: 'BANK_TRANSFER', amount: 3000, partyId: 'p1' })
    expectBalanced(m)
    expect(codeAmt(m, '2000', 'debit')).toBe(3000)
    expect(codeAmt(m, '1100', 'credit')).toBe(3000)
  })
})

describe('mapExpense — ITC split + direct/indirect routing', () => {
  it('indirect expense with GST splits ITC out of the expense leg', () => {
    const e: ExpenseForPosting = { amount: 11800, gstAmount: 1800, paymentMode: 'UPI', categoryName: 'Office Rent' }
    const m = mapExpense(e)
    expectBalanced(m)
    expect(codeAmt(m, '5200', 'debit')).toBe(10000) // amount − gst, indirect
    expect(codeAmt(m, '2100', 'debit')).toBe(1800) // ITC
    expect(codeAmt(m, '1100', 'credit')).toBe(11800)
  })

  it('direct-hint category routes to 5100', () => {
    const m = mapExpense({ amount: 5000, gstAmount: 0, paymentMode: 'CASH', categoryName: 'Raw Material' })
    expectBalanced(m)
    expect(codeAmt(m, '5100', 'debit')).toBe(5000)
    expect(codeAmt(m, '1000', 'credit')).toBe(5000)
  })

  it('zero-GST expense produces no ITC leg', () => {
    const m = mapExpense({ amount: 2000, gstAmount: 0, paymentMode: 'CASH', categoryName: 'Tea' })
    expectBalanced(m)
    expect(codeAmt(m, '2100', 'debit')).toBe(0)
    expect(m.lines.find((l) => l.code === '2100')).toBeUndefined()
  })
})
