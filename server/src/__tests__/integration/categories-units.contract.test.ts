/**
 * Categories & Units — Contract Tests (REAL DB)
 * Validates CRUD for product categories and units.
 */

import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { generateToken, authRequest, anonRequest } from './auth-helper.js'
import { seedFullSetup } from './factories.js'

const app = createApp()

// ─── Categories ──────────────────────────────────────────────────────────────

describe('POST /api/categories', () => {
  it('creates a category', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .post('/api/categories')
      .send({ name: `Cat-${Date.now()}` })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.category).toBeDefined()
    expect(res.body.data.category.name).toBeTruthy()
  })

  it('returns 401 without auth', async () => {
    const res = await anonRequest(app).post('/api/categories').send({ name: 'X' })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/categories', () => {
  it('lists categories for the business', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)
    // seedFullSetup creates a category already
    const res = await authRequest(app, token).get('/api/categories')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })
})

describe('PUT /api/categories/:id', () => {
  it('updates a category name', async () => {
    const { user, business, category } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .put(`/api/categories/${category.id}`)
      .send({ name: `Updated-${Date.now()}` })

    expect(res.status).toBe(200)
    expect(res.body.data.category.name).toContain('Updated')
  })
})

describe('DELETE /api/categories/:id', () => {
  it('deletes a category with reassignment', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    // Create two categories, delete one with reassignment to the other
    const c1 = await authRequest(app, token)
      .post('/api/categories').send({ name: `Del-${Date.now()}` })
    const c2 = await authRequest(app, token)
      .post('/api/categories').send({ name: `Keep-${Date.now()}` })

    const res = await authRequest(app, token)
      .delete(`/api/categories/${c1.body.data.category.id}`)
      .send({ reassignTo: c2.body.data.category.id })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

// ─── Units ───────────────────────────────────────────────────────────────────

describe('POST /api/units', () => {
  it('creates a unit', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .post('/api/units')
      .send({ name: `Unit-${Date.now()}`, symbol: `u${Date.now() % 1000}`, type: 'CUSTOM', category: 'WEIGHT' })

    expect(res.status).toBe(201)
    expect(res.body.data.unit).toBeDefined()
  })

  it('returns 401 without auth', async () => {
    const res = await anonRequest(app).post('/api/units').send({ name: 'X', symbol: 'x', type: 'CUSTOM', category: 'COUNT' })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/units', () => {
  it('lists units for the business', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)
    const res = await authRequest(app, token).get('/api/units')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })
})

describe('PUT /api/units/:id', () => {
  it('updates a unit', async () => {
    const { user, business, unit } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .put(`/api/units/${unit.id}`)
      .send({ name: `Renamed-${Date.now()}` })

    expect(res.status).toBe(200)
    expect(res.body.data.unit.name).toContain('Renamed')
  })
})

describe('DELETE /api/units/:id', () => {
  it('deletes a unit', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    // Create a fresh unit (not the one linked to products)
    const created = await authRequest(app, token)
      .post('/api/units')
      .send({ name: `ToDel-${Date.now()}`, symbol: `d${Date.now() % 1000}`, type: 'CUSTOM', category: 'COUNT' })

    const res = await authRequest(app, token)
      .delete(`/api/units/${created.body.data.unit.id}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})
