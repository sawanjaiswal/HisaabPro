/**
 * Settings Routes — Contract Tests (REAL DB)
 * Validates roles and staff CRUD behind owner permission.
 */

import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { generateToken, authRequest, anonRequest } from './auth-helper.js'
import {
  createTestUser,
  createTestBusiness,
  createTestBusinessUser,
  createTestRole,
} from './factories.js'

const app = createApp()

async function ownerSetup() {
  const user = await createTestUser()
  const business = await createTestBusiness(user.id)
  await createTestBusinessUser(user.id, business.id, 'owner')
  const token = generateToken(user.id, user.phone, business.id)
  return { user, business, token }
}

// ─── Roles ──────────────────────────────────────────────────────────────────

describe('POST /api/businesses/:id/roles', () => {
  it('creates a role with permissions', async () => {
    const { business, token } = await ownerSetup()

    const res = await authRequest(app, token)
      .post(`/api/businesses/${business.id}/roles`)
      .send({ name: 'Manager', permissions: ['parties.view', 'parties.create'] })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)

    const dbRole = await prisma.role.findFirst({
      where: { businessId: business.id, name: 'Manager' },
    })
    expect(dbRole).toBeTruthy()
    expect(dbRole!.permissions).toContain('parties.create')
  })
})

describe('GET /api/businesses/:id/roles', () => {
  it('lists roles', async () => {
    const { business, token } = await ownerSetup()
    await createTestRole(business.id, { name: 'R1' })
    await createTestRole(business.id, { name: 'R2' })

    const res = await authRequest(app, token)
      .get(`/api/businesses/${business.id}/roles`)

    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(2)
  })
})

describe('PUT /api/businesses/:id/roles/:roleId', () => {
  it('updates role permissions', async () => {
    const { business, token } = await ownerSetup()
    const role = await createTestRole(business.id, { permissions: ['parties.view'] })

    const res = await authRequest(app, token)
      .put(`/api/businesses/${business.id}/roles/${role.id}`)
      .send({ permissions: ['parties.view', 'inventory.view'] })

    expect(res.status).toBe(200)
    expect(res.body.data.permissions).toContain('inventory.view')
  })
})

describe('DELETE /api/businesses/:id/roles/:roleId', () => {
  it('deletes a role with reassignment', async () => {
    const { business, token } = await ownerSetup()
    const r1 = await createTestRole(business.id, { name: 'ToDelete' })
    const r2 = await createTestRole(business.id, { name: 'Fallback' })

    const res = await authRequest(app, token)
      .delete(`/api/businesses/${business.id}/roles/${r1.id}?reassignTo=${r2.id}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

// ─── Staff ──────────────────────────────────────────────────────────────────

describe('GET /api/businesses/:id/staff', () => {
  it('lists staff members', async () => {
    const { business, token } = await ownerSetup()

    const res = await authRequest(app, token)
      .get(`/api/businesses/${business.id}/staff`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

describe('POST /api/businesses/:id/staff/invite', () => {
  it('invites a staff member', async () => {
    const { business, token } = await ownerSetup()
    const role = await createTestRole(business.id, { name: 'Cashier' })

    const res = await authRequest(app, token)
      .post(`/api/businesses/${business.id}/staff/invite`)
      .send({ name: 'New Staff', phone: '9876543210', roleId: role.id })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
  })
})

// ─── Auth guards ────────────────────────────────────────────────────────────

describe('Auth guards', () => {
  it('returns 401 without auth', async () => {
    const res = await anonRequest(app).get('/api/businesses/fake-id/roles')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-owner creating role', async () => {
    const { business } = await ownerSetup()
    const staffUser = await createTestUser()
    const role = await createTestRole(business.id, { permissions: [] })
    await createTestBusinessUser(staffUser.id, business.id, 'staff', role.id)
    const staffToken = generateToken(staffUser.id, staffUser.phone, business.id)

    const res = await authRequest(app, staffToken)
      .post(`/api/businesses/${business.id}/roles`)
      .send({ name: 'Sneaky', permissions: [] })

    expect(res.status).toBe(403)
  })
})
