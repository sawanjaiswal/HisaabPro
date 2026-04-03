/**
 * Dashboard Routes — Contract Tests (REAL DB)
 * Validates home dashboard and stats endpoints.
 */

import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { generateToken, authRequest, anonRequest } from './auth-helper.js'
import { seedFullSetup } from './factories.js'

const app = createApp()

// ─── GET /api/dashboard/home ────────────────────────────────────────────────

describe('GET /api/dashboard/home', () => {
  it('returns 200 with expected shape', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token).get('/api/dashboard/home')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveProperty('outstanding')
    expect(res.body.data).toHaveProperty('today')
    expect(res.body.data).toHaveProperty('alerts')
  })

  it('returns 401 without auth token', async () => {
    const res = await anonRequest(app).get('/api/dashboard/home')
    expect(res.status).toBe(401)
  })
})

// ─── GET /api/dashboard/stats ───────────────────────────────────────────────

describe('GET /api/dashboard/stats', () => {
  it('returns 200 with default range', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token).get('/api/dashboard/stats')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeDefined()
  })

  it('returns 200 with this_month range', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token)
      .get('/api/dashboard/stats?range=this_month')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('returns 401 without auth token', async () => {
    const res = await anonRequest(app).get('/api/dashboard/stats')
    expect(res.status).toBe(401)
  })
})
