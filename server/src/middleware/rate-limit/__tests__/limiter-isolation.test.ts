/**
 * Each limiter owns its own bucket.
 *
 * Before this test, every IP-keyed limiter derived the key `rl:<ip>`, so the
 * global limiter (600/min), the auth limiter (20/min) and the OTP limiter
 * (3/10min) all incremented and read ONE counter. The practical effect was that
 * 25 ordinary GETs — a quarter of the way into the global budget — pushed the
 * shared count past the auth limiter's max, and the next `/api/auth/refresh`
 * 429'd, logging out an active user. See .claude/fix-trace-ratelimit-shared-bucket.md.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { createRateLimiter } from '../factory.js'

const KEYS: string[] = []

vi.mock('../store.js', () => ({
  getStore: async () => ({
    async increment(key: string, windowMs: number) {
      KEYS.push(key)
      const counts = KEYS.filter((k) => k === key).length
      return { count: counts, resetAt: Date.now() + windowMs }
    },
    async reset() {},
  }),
}))

function reqFor(path: string): Request {
  return { ip: '1.2.3.4', path, method: 'GET', headers: {} } as unknown as Request
}

function resSpy(): { res: Response; status: () => number | null } {
  let code: number | null = null
  const res = {
    set: () => res,
    status(c: number) {
      code = c
      return res
    },
    json: () => res,
  } as unknown as Response
  return { res, status: () => code }
}

async function run(
  limiter: (req: Request, res: Response, next: NextFunction) => unknown,
  path: string,
): Promise<number | null> {
  const { res, status } = resSpy()
  await limiter(reqFor(path), res, () => {})
  return status()
}

describe('rate limiter bucket isolation', () => {
  beforeEach(() => {
    KEYS.length = 0
  })

  it('does not let a permissive limiter exhaust a strict one', async () => {
    const globalish = createRateLimiter({
      name: 'global',
      windowMs: 60_000,
      max: 600,
      message: 'slow down',
    })
    const strict = createRateLimiter({
      name: 'auth',
      windowMs: 60_000,
      max: 20,
      message: 'too many attempts',
    })

    for (let i = 0; i < 25; i++) {
      expect(await run(globalish, '/api/parties')).toBeNull()
    }

    // The strict limiter has served exactly one request. It must not be at 25.
    expect(await run(strict, '/api/auth/login')).toBeNull()
  })

  it('namespaces the derived key by limiter name', async () => {
    const a = createRateLimiter({ name: 'auth', windowMs: 1000, max: 5, message: 'x' })
    const b = createRateLimiter({ name: 'otp', windowMs: 1000, max: 5, message: 'x' })
    await run(a, '/api/auth/login')
    await run(b, '/api/auth/resend-otp')

    expect(KEYS).toEqual(['rl:auth:1.2.3.4', 'rl:otp:1.2.3.4'])
  })

  it('still enforces its own max within its own bucket', async () => {
    const strict = createRateLimiter({ name: 'auth', windowMs: 60_000, max: 3, message: 'x' })
    for (let i = 0; i < 3; i++) expect(await run(strict, '/api/auth/login')).toBeNull()
    expect(await run(strict, '/api/auth/login')).toBe(429)
  })
})
