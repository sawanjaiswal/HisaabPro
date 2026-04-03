/**
 * Product Routes — Contract Tests (REAL DB)
 * Validates product CRUD, stock adjustments, and stock effects.
 */

import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { generateToken, authRequest, anonRequest } from './auth-helper.js'
import {
  seedFullSetup,
  createTestUser,
  createTestBusiness,
  createTestBusinessUser,
  createTestRole,
} from './factories.js'

const app = createApp()

// ─── POST /api/products ─────────────────────────────────────────────────────

describe('POST /api/products', () => {
  it('creates a product and persists to DB', async () => {
    const { user, business, unit, category } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .post('/api/products')
      .send({
        name: 'Test Widget',
        unitId: unit.id,
        categoryId: category.id,
        salePrice: 15000,
        purchasePrice: 10000,
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.product.name).toBe('Test Widget')
    expect(res.body.data.product.salePrice).toBe(15000)

    // Verify DB
    const dbProduct = await prisma.product.findFirst({
      where: { businessId: business.id, name: 'Test Widget' },
    })
    expect(dbProduct).toBeTruthy()
    expect(dbProduct!.salePrice).toBe(15000)
  })

  it('returns 400 when name is missing', async () => {
    const { user, business, unit } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .post('/api/products')
      .send({ unitId: unit.id, salePrice: 25000 })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 401 without auth token', async () => {
    const res = await anonRequest(app)
      .post('/api/products')
      .send({ name: 'Test', unitId: 'u1', salePrice: 1000 })

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('returns 403 for staff without inventory.create permission', async () => {
    const user = await createTestUser()
    const business = await createTestBusiness(user.id)
    const role = await createTestRole(business.id, { permissions: [] })
    await createTestBusinessUser(user.id, business.id, 'staff', role.id)
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .post('/api/products')
      .send({ name: 'Blocked', unitId: 'u1', salePrice: 1000 })

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })
})

// ─── GET /api/products ──────────────────────────────────────────────────────

describe('GET /api/products', () => {
  it('lists products with pagination', async () => {
    const { user, business, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token).get('/api/products')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.products.length).toBeGreaterThanOrEqual(1)

    const names = res.body.data.products.map((p: { name: string }) => p.name)
    expect(names).toContain(product.name)
  })
})

// ─── GET /api/products/:id ──────────────────────────────────────────────────

describe('GET /api/products/:id', () => {
  it('returns full product detail', async () => {
    const { user, business, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token).get(`/api/products/${product.id}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.product.id).toBe(product.id)
    expect(res.body.data.product.name).toBe(product.name)
  })
})

// ─── PUT /api/products/:id ──────────────────────────────────────────────────

describe('PUT /api/products/:id', () => {
  it('updates product fields and verifies DB', async () => {
    const { user, business, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .put(`/api/products/${product.id}`)
      .send({ name: 'Updated Widget', salePrice: 20000 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.product.name).toBe('Updated Widget')

    // Verify DB
    const dbProduct = await prisma.product.findUnique({
      where: { id: product.id },
    })
    expect(dbProduct!.name).toBe('Updated Widget')
    expect(dbProduct!.salePrice).toBe(20000)
  })
})

// ─── DELETE /api/products/:id ───────────────────────────────────────────────

describe('DELETE /api/products/:id', () => {
  it('soft-deletes a product', async () => {
    const { user, business, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .delete(`/api/products/${product.id}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Verify DB — product should be soft-deleted (status=INACTIVE)
    const dbProduct = await prisma.product.findUnique({
      where: { id: product.id },
    })
    expect(dbProduct!.status).toBe('INACTIVE')
  })
})

// ─── POST /api/products/:id/stock/adjust ────────────────────────────────────

describe('POST /api/products/:id/stock/adjust', () => {
  it('adjusts stock in and updates product', async () => {
    const { user, business, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)
    const stockBefore = product.currentStock

    const res = await authRequest(app, token)
      .post(`/api/products/${product.id}/stock/adjust`)
      .send({
        type: 'ADJUSTMENT_IN',
        quantity: 25,
        reason: 'AUDIT',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.product.currentStock).toBe(stockBefore + 25)
    expect(res.body.data.product.previousStock).toBe(stockBefore)

    // Verify DB
    const dbProduct = await prisma.product.findUnique({
      where: { id: product.id },
    })
    expect(dbProduct!.currentStock).toBe(stockBefore + 25)
  })

  it('adjusts stock out and creates movement record', async () => {
    const { user, business, product } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)
    const stockBefore = product.currentStock

    const res = await authRequest(app, token)
      .post(`/api/products/${product.id}/stock/adjust`)
      .send({
        type: 'ADJUSTMENT_OUT',
        quantity: 10,
        reason: 'DAMAGE',
      })

    expect(res.status).toBe(200)
    expect(res.body.data.product.currentStock).toBe(stockBefore - 10)

    // Verify stock movement was created
    const movements = await prisma.stockMovement.findMany({
      where: { productId: product.id },
    })
    expect(movements.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── Permission boundaries ──────────────────────────────────────────────────

describe('Permission boundaries', () => {
  it('staff with inventory.create can create products', async () => {
    const user = await createTestUser()
    const business = await createTestBusiness(user.id)
    const role = await createTestRole(business.id, {
      permissions: ['inventory.create'],
    })
    await createTestBusinessUser(user.id, business.id, 'staff', role.id)
    const token = generateToken(user.id, user.phone, business.id)

    // Need a unit for product creation
    const unit = await prisma.unit.create({
      data: {
        businessId: business.id,
        name: 'Piece',
        symbol: 'pc',
        type: 'CUSTOM',
        category: 'COUNT',
      },
    })

    const res = await authRequest(app, token)
      .post('/api/products')
      .send({ name: 'Staff Product', unitId: unit.id, salePrice: 5000 })

    expect(res.status).toBe(201)
    expect(res.body.data.product.name).toBe('Staff Product')
  })
})
