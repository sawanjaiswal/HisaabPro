/**
 * Tax Categories & Party Groups — list wire-shape contract (REAL DB)
 * Regression test for the blank-pane bug: GET / must send a flat array to
 * match the FE services (tax.service.ts / party-group.service.ts), which
 * already type the api() result as a flat array, not a { key: [...] } wrapper.
 */

import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { generateToken, authRequest } from './auth-helper.js'
import { seedFullSetup } from './factories.js'

const app = createApp()

describe('GET /api/tax-categories', () => {
  it('returns data as a flat array, not wrapped in { categories }', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token).get('/api/tax-categories')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('GET /api/party-groups', () => {
  it('returns data as a flat array, not wrapped in { groups }', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token).get('/api/party-groups')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})
