/**
 * Frequent-Products — Contract Tests (REAL DB)
 *
 * GET /api/parties/:id/frequent-products powers the "usually bought" chips on
 * the invoice screen. Pins: ranking by distinct-invoice frequency, DRAFT
 * exclusion, party isolation (one party's history never bleeds into another's),
 * live product filtering, and 404 for an unknown party.
 */

import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { generateToken, authRequest } from './auth-helper.js'
import { seedFullSetup, createTestProduct, createTestParty } from './factories.js'

const app = createApp()

const today = () => new Date().toISOString().split('T')[0]

function invoiceBody(
  partyId: string,
  productId: string,
  status: 'SAVED' | 'DRAFT' = 'SAVED',
) {
  return {
    type: 'SALE_INVOICE',
    status,
    partyId,
    documentDate: today(),
    lineItems: [{ productId, quantity: 1, rate: 10000, discountType: 'AMOUNT', discountValue: 0 }],
    additionalCharges: [],
    includeSignature: false,
  }
}

describe('GET /api/parties/:id/frequent-products', () => {
  it('returns an empty list for a party with no purchase history', async () => {
    const { user, business, party } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token).get(`/api/parties/${party.id}/frequent-products`)

    expect(res.status).toBe(200)
    expect(res.body.data.frequentProducts).toEqual([])
  })

  it('ranks products by distinct-invoice frequency for the party', async () => {
    const { user, business, party, unit, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)
    const other = await createTestProduct(business.id, unit.id)

    // product → 2 invoices, other → 1 invoice
    await authRequest(app, token).post('/api/documents').send(invoiceBody(party.id, product.id))
    await authRequest(app, token).post('/api/documents').send(invoiceBody(party.id, product.id))
    await authRequest(app, token).post('/api/documents').send(invoiceBody(party.id, other.id))

    const res = await authRequest(app, token).get(`/api/parties/${party.id}/frequent-products`)

    expect(res.status).toBe(200)
    const list = res.body.data.frequentProducts
    expect(list).toHaveLength(2)
    expect(list[0].productId).toBe(product.id)
    expect(list[0].purchaseCount).toBe(2)
    expect(list[1].productId).toBe(other.id)
    expect(list[1].purchaseCount).toBe(1)
    // Carries what the item search needs to add a line in one tap.
    expect(list[0]).toMatchObject({ name: product.name, salePrice: product.salePrice })
  })

  it('excludes DRAFT invoices — only committed sales count', async () => {
    const { user, business, party, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    await authRequest(app, token).post('/api/documents').send(invoiceBody(party.id, product.id, 'DRAFT'))

    const res = await authRequest(app, token).get(`/api/parties/${party.id}/frequent-products`)

    expect(res.status).toBe(200)
    expect(res.body.data.frequentProducts).toEqual([])
  })

  it('never surfaces another party\'s history', async () => {
    const { user, business, party, unit } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)
    const party2 = await createTestParty(business.id)
    const product2 = await createTestProduct(business.id, unit.id)

    // party2 buys product2; party1 has nothing.
    await authRequest(app, token).post('/api/documents').send(invoiceBody(party2.id, product2.id))

    const res = await authRequest(app, token).get(`/api/parties/${party.id}/frequent-products`)

    expect(res.status).toBe(200)
    expect(res.body.data.frequentProducts).toEqual([])
  })

  it('404s for a party that does not belong to the business', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token).get('/api/parties/00000000-0000-0000-0000-000000000000/frequent-products')

    expect(res.status).toBe(404)
  })
})
