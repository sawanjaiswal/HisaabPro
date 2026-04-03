/**
 * Document Routes — Contract Tests (REAL DB)
 * Validates full request→DB→response for document CRUD, stock, outstanding.
 */

import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { generateToken, authRequest } from './auth-helper.js'
import { seedFullSetup } from './factories.js'

const app = createApp()

/** Helper: build a minimal valid create-document body */
function saleInvoiceBody(partyId: string, productId: string) {
  return {
    type: 'SALE_INVOICE',
    status: 'SAVED',
    partyId,
    documentDate: new Date().toISOString().split('T')[0],
    lineItems: [
      {
        productId,
        quantity: 5,
        rate: 10000, // Rs 100
        discountType: 'AMOUNT',
        discountValue: 0,
      },
    ],
    additionalCharges: [],
    includeSignature: false,
  }
}

// ─── POST /api/documents ─────────────────────────────────────────────────────

describe('POST /api/documents', () => {
  it('creates a sale invoice with line items and correct totals', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)
    const body = saleInvoiceBody(party.id, product.id)

    const res = await authRequest(app, token)
      .post('/api/documents')
      .send(body)

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)

    const doc = res.body.data
    expect(doc.type).toBe('SALE_INVOICE')
    expect(doc.status).toBe('SAVED')
    // 5 * 10000 = 50000 paise
    expect(doc.grandTotal).toBe(50000)
    expect(doc.documentNumber).toBeTruthy()

    // Verify DB
    const dbDoc = await prisma.document.findUnique({
      where: { id: doc.id },
      include: { lineItems: true },
    })
    expect(dbDoc).toBeTruthy()
    expect(dbDoc!.lineItems).toHaveLength(1)
    expect(dbDoc!.lineItems[0].quantity).toBe(5)
    expect(dbDoc!.grandTotal).toBe(50000)
  })

  it('deducts stock when sale invoice is SAVED', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)
    const stockBefore = product.currentStock

    await authRequest(app, token)
      .post('/api/documents')
      .send(saleInvoiceBody(party.id, product.id))

    const dbProduct = await prisma.product.findUnique({
      where: { id: product.id },
    })
    expect(dbProduct!.currentStock).toBe(stockBefore - 5)
  })

  it('increases party outstanding on sale invoice', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)
    const outstandingBefore = party.outstandingBalance

    await authRequest(app, token)
      .post('/api/documents')
      .send(saleInvoiceBody(party.id, product.id))

    const dbParty = await prisma.party.findUnique({
      where: { id: party.id },
    })
    // Sale invoice adds grandTotal (50000) to outstanding
    expect(dbParty!.outstandingBalance).toBe(outstandingBefore + 50000)
  })
})

// ─── GET /api/documents ──────────────────────────────────────────────────────

describe('GET /api/documents', () => {
  it('lists documents with filtering by type', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    // Create a document first
    await authRequest(app, token)
      .post('/api/documents')
      .send(saleInvoiceBody(party.id, product.id))

    const res = await authRequest(app, token)
      .get('/api/documents?type=SALE_INVOICE')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.documents.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data.pagination).toBeDefined()
  })
})

// ─── GET /api/documents/:id ──────────────────────────────────────────────────

describe('GET /api/documents/:id', () => {
  it('returns full detail with line items', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const createRes = await authRequest(app, token)
      .post('/api/documents')
      .send(saleInvoiceBody(party.id, product.id))
    const docId = createRes.body.data.id

    const res = await authRequest(app, token)
      .get(`/api/documents/${docId}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBe(docId)
    expect(res.body.data.lineItems).toBeDefined()
    expect(res.body.data.lineItems.length).toBe(1)
  })
})

// ─── PUT /api/documents/:id ──────────────────────────────────────────────────

describe('PUT /api/documents/:id', () => {
  it('updates document and recalculates totals', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const createRes = await authRequest(app, token)
      .post('/api/documents')
      .send(saleInvoiceBody(party.id, product.id))
    const docId = createRes.body.data.id

    const res = await authRequest(app, token)
      .put(`/api/documents/${docId}`)
      .send({
        lineItems: [
          {
            productId: product.id,
            quantity: 10,
            rate: 10000,
            discountType: 'AMOUNT',
            discountValue: 0,
          },
        ],
        additionalCharges: [],
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // 10 * 10000 = 100000
    expect(res.body.data.grandTotal).toBe(100000)
  })
})

// ─── DELETE /api/documents/:id ───────────────────────────────────────────────

describe('DELETE /api/documents/:id', () => {
  it('soft-deletes to recycle bin', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const createRes = await authRequest(app, token)
      .post('/api/documents')
      .send(saleInvoiceBody(party.id, product.id))
    const docId = createRes.body.data.id

    const res = await authRequest(app, token)
      .delete(`/api/documents/${docId}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('DELETED')

    // Verify DB — status should be DELETED
    const dbDoc = await prisma.document.findUnique({
      where: { id: docId },
    })
    expect(dbDoc!.status).toBe('DELETED')
    expect(dbDoc!.deletedAt).toBeTruthy()
  })

  it('reverses stock on delete', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)
    const stockBefore = product.currentStock

    const createRes = await authRequest(app, token)
      .post('/api/documents')
      .send(saleInvoiceBody(party.id, product.id))
    const docId = createRes.body.data.id

    // Delete it — should reverse stock
    await authRequest(app, token).delete(`/api/documents/${docId}`)

    const dbProduct = await prisma.product.findUnique({
      where: { id: product.id },
    })
    expect(dbProduct!.currentStock).toBe(stockBefore)
  })

  it('reverses outstanding on delete', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)
    const outstandingBefore = party.outstandingBalance

    const createRes = await authRequest(app, token)
      .post('/api/documents')
      .send(saleInvoiceBody(party.id, product.id))
    const docId = createRes.body.data.id

    await authRequest(app, token).delete(`/api/documents/${docId}`)

    const dbParty = await prisma.party.findUnique({
      where: { id: party.id },
    })
    expect(dbParty!.outstandingBalance).toBe(outstandingBefore)
  })
})
