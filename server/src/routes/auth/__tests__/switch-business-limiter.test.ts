/**
 * switch-business rate limiter — must NOT share the login brute-force bucket.
 *
 * Regression guard for the multi-store lockout bug: switch-business is an
 * authenticated action, so it gets its own generous limiter (60/min). The
 * login bucket (authRateLimiter, 20/min) would lock out a real multi-store
 * owner. This test proves the switch limiter allows more than the auth cap
 * before it 429s.
 */
import { describe, it, expect } from 'vitest'
import type { Request, Response } from 'express'
// Import the REAL limiter directly — the global setup.ts mocks the rate-limit
// barrel to passthrough, which would hide the behaviour under test.
import { switchBusinessRateLimiter } from '../../../middleware/rate-limit/auth-limiters.js'
import {
  RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_SWITCH_BUSINESS_MAX,
} from '../../../config/security.js'

function fakeReqRes(ip: string) {
  let status = 0
  const req = { ip, path: '/switch-business', method: 'POST', headers: {} } as unknown as Request
  const res = {
    set: () => res,
    status: (s: number) => { status = s; return res },
    json: () => res,
  } as unknown as Response
  return { req, res, get status() { return status } }
}

async function hit(ip: string): Promise<boolean> {
  const ctx = fakeReqRes(ip)
  let passed = false
  await switchBusinessRateLimiter(ctx.req, ctx.res, () => { passed = true })
  return passed // true = allowed through, false = 429'd
}

describe('switchBusinessRateLimiter', () => {
  it('is configured well above the login bucket', () => {
    expect(RATE_LIMIT_SWITCH_BUSINESS_MAX).toBe(60)
    expect(RATE_LIMIT_SWITCH_BUSINESS_MAX).toBeGreaterThan(RATE_LIMIT_AUTH_MAX)
  })

  it('allows more than the auth cap from one IP before limiting', async () => {
    const ip = '203.0.113.7'
    // The request that would have been blocked by the login bucket (the
    // RATE_LIMIT_AUTH_MAX + 1'th) must still pass on the switch limiter.
    for (let i = 0; i < RATE_LIMIT_AUTH_MAX; i++) await hit(ip)
    const justPastAuthCap = await hit(ip) // request #21 on a 20-cap bucket
    expect(justPastAuthCap).toBe(true)
  })

  it('does eventually limit a runaway client', async () => {
    const ip = '203.0.113.8'
    for (let i = 0; i < RATE_LIMIT_SWITCH_BUSINESS_MAX; i++) await hit(ip)
    const overCap = await hit(ip) // request #61 on a 60-cap bucket
    expect(overCap).toBe(false)
  })
})
