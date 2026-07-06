/**
 * GET /api/documents — ETag / conditional-GET contract test.
 *
 * TanStack Query owns client-side caching; the API must never answer a
 * repeat GET with an empty 304 (see .claude/fix-trace-sales-hub-etag-304.md).
 * Every GET on this endpoint must return the full JSON body, even when the
 * client echoes back a prior response's ETag via If-None-Match.
 */

import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { generateToken, authRequest } from './auth-helper.js'
import { seedFullSetup } from './factories.js'

const app = createApp()

describe('GET /api/documents — conditional-GET contract', () => {
  it('returns the full JSON body on a repeat identical request, never a 304', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)
    const auth = authRequest(app, token)

    const first = await auth.get('/api/documents?type=SALE_ORDER')
    expect(first.status).toBe(200)
    expect(first.body.data).toBeDefined()

    const etag = first.headers['etag']

    const second = await auth
      .get('/api/documents?type=SALE_ORDER')
      .set('If-None-Match', etag ?? '')

    expect(second.status).toBe(200)
    expect(second.body.data).toBeDefined()
    expect(second.body.success).toBe(true)
  })
})
