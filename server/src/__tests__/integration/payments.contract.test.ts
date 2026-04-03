/**
 * Payment Routes — Contract Tests (REAL DB)
 * Validates payment CRUD, allocations, outstanding effects.
 */

import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { generateToken, authRequest } from './auth-helper.js'
import { seedFullSetup } from './factories.js'

const app = createApp()

/** Helper: create a sale invoice so we have something to allocate to */
async function createInvoice(
  token: string,
  partyId: string,
  productId: string
) {
  const res = await authRequest(app, token)
    .post('/api/documents')
    .send({
      type: 'SALE_INVOICE',
      status: 'SAVED',
      partyId,
      documentDate: new Date().toISOString().split('T')[0],
      lineItems: [
        {
          productId,
          quantity: 2,
          rate: 50000, // Rs 500
          discountType: 'AMOUNT',
          discountValue: 0,
        },
      ],
      additionalCharges: [],
      includeSignature: false,
    })
  return res.body.data
}

// ─── POST /api/payments ──────────────────────────────────────────────────────

describe('POST /api/payments', () => {
  it('creates payment and decreases party outstanding', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    // Create invoice (outstanding goes up by 100000)
    await createInvoice(token, party.id, product.id)

    const partyBefore = await prisma.party.findUnique({
      where: { id: party.id },
    })

    const res = await authRequest(app, token)
      .post('/api/payments')
      .send({
        type: 'PAYMENT_IN',
        partyId: party.id,
        amount: 50000, // Rs 500 partial
        date: new Date().toISOString().split('T')[0],
        mode: 'CASH',
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)

    // Outstanding should decrease by 50000
    const partyAfter = await prisma.party.findUnique({
      where: { id: party.id },
    })
    expect(partyAfter!.outstandingBalance).toBe(
      partyBefore!.outstandingBalance - 50000
    )
  })

  it('creates payment with allocation and updates invoice balanceDue', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const invoice = await createInvoice(token, party.id, product.id)
    const invoiceId = invoice.id
    const grandTotal = invoice.grandTotal // 100000

    const res = await authRequest(app, token)
      .post('/api/payments')
      .send({
        type: 'PAYMENT_IN',
        partyId: party.id,
        amount: 60000,
        date: new Date().toISOString().split('T')[0],
        mode: 'UPI',
        allocations: [{ invoiceId, amount: 60000 }],
      })

    expect(res.status).toBe(201)

    // Verify invoice balanceDue decreased
    const dbDoc = await prisma.document.findUnique({
      where: { id: invoiceId },
    })
    expect(dbDoc!.balanceDue).toBe(grandTotal - 60000)
    expect(dbDoc!.paidAmount).toBe(60000)
  })
})

// ─── GET /api/payments ───────────────────────────────────────────────────────

describe('GET /api/payments', () => {
  it('lists payments with pagination', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    await createInvoice(token, party.id, product.id)
    await authRequest(app, token)
      .post('/api/payments')
      .send({
        type: 'PAYMENT_IN',
        partyId: party.id,
        amount: 10000,
        date: new Date().toISOString().split('T')[0],
        mode: 'CASH',
      })

    const res = await authRequest(app, token).get('/api/payments')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.payments.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data.pagination).toBeDefined()
  })
})

// ─── DELETE /api/payments/:id ────────────────────────────────────────────────

describe('DELETE /api/payments/:id', () => {
  it('reverses outstanding on payment delete', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    await createInvoice(token, party.id, product.id)

    const createRes = await authRequest(app, token)
      .post('/api/payments')
      .send({
        type: 'PAYMENT_IN',
        partyId: party.id,
        amount: 30000,
        date: new Date().toISOString().split('T')[0],
        mode: 'BANK_TRANSFER',
      })
    const paymentId = createRes.body.data.id

    const partyBeforeDelete = await prisma.party.findUnique({
      where: { id: party.id },
    })

    const res = await authRequest(app, token)
      .delete(`/api/payments/${paymentId}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Outstanding should increase back by 30000
    const partyAfterDelete = await prisma.party.findUnique({
      where: { id: party.id },
    })
    expect(partyAfterDelete!.outstandingBalance).toBe(
      partyBeforeDelete!.outstandingBalance + 30000
    )
  })

  it('reverses invoice balanceDue on allocated payment delete', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const invoice = await createInvoice(token, party.id, product.id)

    const createRes = await authRequest(app, token)
      .post('/api/payments')
      .send({
        type: 'PAYMENT_IN',
        partyId: party.id,
        amount: 40000,
        date: new Date().toISOString().split('T')[0],
        mode: 'CASH',
        allocations: [{ invoiceId: invoice.id, amount: 40000 }],
      })
    const paymentId = createRes.body.data.id

    await authRequest(app, token).delete(`/api/payments/${paymentId}`)

    // Invoice balanceDue should be restored to grandTotal
    const dbDoc = await prisma.document.findUnique({
      where: { id: invoice.id },
    })
    expect(dbDoc!.balanceDue).toBe(invoice.grandTotal)
    expect(dbDoc!.paidAmount).toBe(0)
  })
})
