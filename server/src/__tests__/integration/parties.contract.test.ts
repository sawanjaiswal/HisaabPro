/**
 * Party Routes — Contract Tests (REAL DB)
 * Validates full request→DB→response cycle for party CRUD.
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

// ─── POST /api/parties ───────────────────────────────────────────────────────

describe('POST /api/parties', () => {
  it('creates a party and persists to DB', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .post('/api/parties')
      .send({ name: 'Raju Store', type: 'CUSTOMER' })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.party.name).toBe('Raju Store')
    expect(res.body.data.party.type).toBe('CUSTOMER')

    // Verify DB state
    const dbParty = await prisma.party.findFirst({
      where: { businessId: business.id, name: 'Raju Store' },
    })
    expect(dbParty).toBeTruthy()
    expect(dbParty!.type).toBe('CUSTOMER')
    expect(dbParty!.isActive).toBe(true)
  })

  it('returns 400 when name is missing', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .post('/api/parties')
      .send({ type: 'CUSTOMER' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 401 without auth token', async () => {
    const res = await anonRequest(app)
      .post('/api/parties')
      .send({ name: 'Test', type: 'CUSTOMER' })

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('returns 403 for staff without parties.create permission', async () => {
    const user = await createTestUser()
    const business = await createTestBusiness(user.id)
    const role = await createTestRole(business.id, { permissions: [] })
    await createTestBusinessUser(user.id, business.id, 'staff', role.id)
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .post('/api/parties')
      .send({ name: 'Blocked', type: 'CUSTOMER' })

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })
})

// ─── GET /api/parties ────────────────────────────────────────────────────────

describe('GET /api/parties', () => {
  it('lists parties with pagination', async () => {
    const { user, business, party } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token).get('/api/parties')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.parties.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data.pagination).toBeDefined()
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1)

    const names = res.body.data.parties.map((p: { name: string }) => p.name)
    expect(names).toContain(party.name)
  })
})

// ─── GET /api/parties/:id ────────────────────────────────────────────────────

describe('GET /api/parties/:id', () => {
  it('returns full party detail', async () => {
    const { user, business, party } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token).get(`/api/parties/${party.id}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.party.id).toBe(party.id)
    expect(res.body.data.party.name).toBe(party.name)
  })

  it('returns 404 for non-existent party', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token).get('/api/parties/nonexistent')

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })
})

// ─── PUT /api/parties/:id ────────────────────────────────────────────────────

describe('PUT /api/parties/:id', () => {
  it('updates party fields and verifies DB', async () => {
    const { user, business, party } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .put(`/api/parties/${party.id}`)
      .send({ name: 'Updated Name' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.party.name).toBe('Updated Name')

    // Verify DB
    const dbParty = await prisma.party.findUnique({
      where: { id: party.id },
    })
    expect(dbParty!.name).toBe('Updated Name')
  })
})

// ─── DELETE /api/parties/:id ─────────────────────────────────────────────────

describe('DELETE /api/parties/:id', () => {
  it('soft-deletes a party', async () => {
    const { user, business, party } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .delete(`/api/parties/${party.id}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Verify DB — party should be soft-deleted (isActive=false)
    const dbParty = await prisma.party.findUnique({
      where: { id: party.id },
    })
    // Soft delete sets isActive=false or isDeleted=true
    expect(
      dbParty!.isActive === false || dbParty!.isDeleted === true
    ).toBe(true)
  })
})

// ─── Permission boundary ─────────────────────────────────────────────────────

describe('Permission boundaries', () => {
  it('staff with parties.create can create', async () => {
    const user = await createTestUser()
    const business = await createTestBusiness(user.id)
    const role = await createTestRole(business.id, {
      permissions: ['parties.create'],
    })
    await createTestBusinessUser(user.id, business.id, 'staff', role.id)
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .post('/api/parties')
      .send({ name: 'Staff Party', type: 'SUPPLIER' })

    expect(res.status).toBe(201)
    expect(res.body.data.party.type).toBe('SUPPLIER')
  })
})
