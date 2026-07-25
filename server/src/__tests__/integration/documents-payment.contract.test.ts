/**
 * Payment-at-creation — Contract Tests (REAL DB)
 *
 * Covers the gold-standard "sell in one shot" flow: POST /api/documents with a
 * nested `payment` records the money received via the canonical createPayment
 * service (allocation + party outstanding + GL). Also pins the contract-drift
 * guard: the strict create schema must reject the form-only top-level
 * `supplyType` / `vehicleNumber` keys, so the FE has to strip them before the
 * wire (server derives supplyType; vehicleNumber lives under transportDetails).
 */

import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { generateToken, authRequest } from './auth-helper.js'
import { seedFullSetup } from './factories.js'

const app = createApp()

/** Minimal valid create body — one line, 5 × Rs 100 = Rs 500 (50000 paise). */
function saleInvoiceBody(partyId: string, productId: string, extra: Record<string, unknown> = {}) {
  return {
    type: 'SALE_INVOICE',
    status: 'SAVED',
    partyId,
    documentDate: new Date().toISOString().split('T')[0],
    lineItems: [
      { productId, quantity: 5, rate: 10000, discountType: 'AMOUNT', discountValue: 0 },
    ],
    additionalCharges: [],
    includeSignature: false,
    ...extra,
  }
}

// ─── Contract-drift guard ────────────────────────────────────────────────────

describe('POST /api/documents — strict schema rejects form-only keys', () => {
  it('400s when the body carries a top-level supplyType (server derives it)', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .post('/api/documents')
      .send(saleInvoiceBody(party.id, product.id, { supplyType: 'B2C_SMALL' }))

    expect(res.status).toBe(400)
  })

  it('400s when the body carries a top-level vehicleNumber (belongs under transportDetails)', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .post('/api/documents')
      .send(saleInvoiceBody(party.id, product.id, { vehicleNumber: 'MH12AB1234' }))

    expect(res.status).toBe(400)
  })
})

// ─── Payment-at-creation ─────────────────────────────────────────────────────

describe('POST /api/documents — payment-at-creation', () => {
  it('records a partial payment and allocates it against the new invoice', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)
    const outstandingBefore = party.outstandingBalance

    const res = await authRequest(app, token)
      .post('/api/documents')
      .send(saleInvoiceBody(party.id, product.id, {
        payment: { amountReceived: 30000, mode: 'UPI', referenceNumber: 'UPI-123' },
      }))

    expect(res.status).toBe(201)
    const doc = res.body.data
    expect(doc.grandTotal).toBe(50000)
    // Response echoes what was received + how much stuck to this invoice
    expect(doc.payment).toBeDefined()
    expect(doc.payment.amount).toBe(30000)
    expect(doc.payment.allocatedAmount).toBe(30000)
    expect(doc.payment.changeAmount).toBe(0)
    expect(doc.payment.mode).toBe('UPI')

    // A real Payment row exists with the allocation
    const payment = await prisma.payment.findUnique({
      where: { id: doc.payment.id },
      include: { allocations: true },
    })
    expect(payment).toBeTruthy()
    expect(payment!.amount).toBe(30000)
    expect(payment!.type).toBe('PAYMENT_IN')
    expect(payment!.allocations).toHaveLength(1)
    expect(payment!.allocations[0].amount).toBe(30000)
    expect(payment!.allocations[0].invoiceId).toBe(doc.id)

    // Invoice balanceDue / paidAmount reflect the allocation
    const dbDoc = await prisma.document.findUnique({ where: { id: doc.id } })
    expect(dbDoc!.paidAmount).toBe(30000)
    expect(dbDoc!.balanceDue).toBe(20000)

    // Party outstanding: +50000 (invoice) then −30000 (payment) = +20000 net
    const dbParty = await prisma.party.findUnique({ where: { id: party.id } })
    expect(dbParty!.outstandingBalance).toBe(outstandingBefore + 20000)
  })

  it('clamps allocation to grandTotal on overpayment and reports change', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)
    const outstandingBefore = party.outstandingBalance

    const res = await authRequest(app, token)
      .post('/api/documents')
      .send(saleInvoiceBody(party.id, product.id, {
        payment: { amountReceived: 60000, mode: 'CASH' },
      }))

    expect(res.status).toBe(201)
    const doc = res.body.data
    expect(doc.payment.amount).toBe(60000)
    expect(doc.payment.allocatedAmount).toBe(50000) // clamped to grandTotal
    expect(doc.payment.changeAmount).toBe(10000)

    // Invoice fully paid
    const dbDoc = await prisma.document.findUnique({ where: { id: doc.id } })
    expect(dbDoc!.paidAmount).toBe(50000)
    expect(dbDoc!.balanceDue).toBe(0)

    // Party outstanding: +50000 (invoice) then −60000 (full payment) = −10000 (advance)
    const dbParty = await prisma.party.findUnique({ where: { id: party.id } })
    expect(dbParty!.outstandingBalance).toBe(outstandingBefore - 10000)
  })

  it('ignores payment on a DRAFT invoice (no Payment row created)', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .post('/api/documents')
      .send(saleInvoiceBody(party.id, product.id, {
        status: 'DRAFT',
        payment: { amountReceived: 30000, mode: 'UPI' },
      }))

    expect(res.status).toBe(201)
    expect(res.body.data.payment).toBeUndefined()

    const count = await prisma.payment.count({ where: { businessId: business.id } })
    expect(count).toBe(0)
  })

  it('400s when payment.amountReceived is below the minimum (0)', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .post('/api/documents')
      .send(saleInvoiceBody(party.id, product.id, {
        payment: { amountReceived: 0, mode: 'UPI' },
      }))

    expect(res.status).toBe(400)
  })

  it('creates a plain invoice (no payment) exactly as before when payment is omitted', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .post('/api/documents')
      .send(saleInvoiceBody(party.id, product.id))

    expect(res.status).toBe(201)
    expect(res.body.data.payment).toBeUndefined()
    const count = await prisma.payment.count({ where: { businessId: business.id } })
    expect(count).toBe(0)
  })
})
