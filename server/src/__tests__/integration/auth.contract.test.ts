/**
 * Auth Routes — Contract Tests (REAL DB)
 * Validates dev-login, me, logout, switch-business, csrf-token.
 */

import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { generateToken, authRequest, anonRequest } from './auth-helper.js'
import {
  createTestUser,
  createTestBusiness,
  createTestBusinessUser,
} from './factories.js'

const app = createApp()

// ─── GET /api/auth/csrf-token ───────────────────────────────────────────────

describe('GET /api/auth/csrf-token', () => {
  it('returns a CSRF token', async () => {
    const res = await anonRequest(app).get('/api/auth/csrf-token')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.csrfToken).toBeDefined()
    expect(typeof res.body.data.csrfToken).toBe('string')
  })
})

// ─── POST /api/auth/dev-login ───────────────────────────────────────────────

describe('POST /api/auth/dev-login', () => {
  it('logs in with dev credentials and returns user + tokens', async () => {
    const res = await anonRequest(app)
      .post('/api/auth/dev-login')
      .send({ username: 'admin', password: 'admin123' })

    expect(res.status).toBeOneOf([200, 201])
    expect(res.body.success).toBe(true)
    expect(res.body.data.user).toBeDefined()
    expect(res.body.data.user.id).toBeDefined()
    expect(res.body.data.businesses).toBeDefined()
  })

  it('returns 400 for invalid credentials', async () => {
    const res = await anonRequest(app)
      .post('/api/auth/dev-login')
      .send({ username: 'admin', password: 'wrong-password' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('LOGIN_FAILED')
  })

  it('returns 400 for missing fields', async () => {
    const res = await anonRequest(app)
      .post('/api/auth/dev-login')
      .send({ username: 'admin' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})

// ─── GET /api/auth/me ───────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns current user profile when authenticated', async () => {
    const user = await createTestUser()
    const business = await createTestBusiness(user.id)
    await createTestBusinessUser(user.id, business.id, 'owner')
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token).get('/api/auth/me')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user).toBeDefined()
    expect(res.body.data.user.id).toBe(user.id)
    expect(res.body.data.businesses).toBeDefined()
  })

  it('returns 401 without auth', async () => {
    const res = await anonRequest(app).get('/api/auth/me')

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })
})

// ─── POST /api/auth/logout ──────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('logs out authenticated user', async () => {
    const user = await createTestUser()
    const business = await createTestBusiness(user.id)
    await createTestBusinessUser(user.id, business.id, 'owner')
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token).post('/api/auth/logout').send({})

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.message).toBe('Logged out successfully')
  })

  it('returns 401 without auth', async () => {
    const res = await anonRequest(app).post('/api/auth/logout').send({})

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })
})

// ─── POST /api/auth/switch-business ─────────────────────────────────────────

describe('POST /api/auth/switch-business', () => {
  it('switches to another business', async () => {
    const user = await createTestUser()
    const biz1 = await createTestBusiness(user.id)
    const biz2 = await createTestBusiness(user.id)
    await createTestBusinessUser(user.id, biz1.id, 'owner')
    await createTestBusinessUser(user.id, biz2.id, 'owner')
    const token = generateToken(user.id, user.phone, biz1.id)

    const res = await authRequest(app, token)
      .post('/api/auth/switch-business')
      .send({ businessId: biz2.id })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.business).toBeDefined()
    expect(res.body.data.business.id).toBe(biz2.id)
  })

  it('returns 400 when switching to current business', async () => {
    const user = await createTestUser()
    const business = await createTestBusiness(user.id)
    await createTestBusinessUser(user.id, business.id, 'owner')
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .post('/api/auth/switch-business')
      .send({ businessId: business.id })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('ALREADY_ACTIVE')
  })

  it('returns 401 without auth', async () => {
    const res = await anonRequest(app)
      .post('/api/auth/switch-business')
      .send({ businessId: 'some-id' })

    expect(res.status).toBe(401)
  })
})

// ─── App-Level Routes ───────────────────────────────────────────────────────

describe('App-Level Routes', () => {
  it('health check returns ok', async () => {
    const res = await anonRequest(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('ok')
  })

  it('unknown route returns 404', async () => {
    const user = await createTestUser()
    const business = await createTestBusiness(user.id)
    await createTestBusinessUser(user.id, business.id, 'owner')
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token).get('/api/nonexistent')

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })
})
