/**
 * Global test setup — runs before all test files.
 * Mocks Prisma client to prevent real DB connections.
 */

import { vi } from 'vitest'

// Mock Prisma globally — Proxy auto-stubs any model.method() with vi.fn() so
// tests never crash on "undefined.findUnique" for newer models added to schema.
// Individual tests still override per-method via vi.mocked(prisma.x.y).mockResolvedValue(...).
vi.mock('../lib/prisma.js', () => {
  const modelCache = new Map<string, Record<string, ReturnType<typeof vi.fn>>>()
  // Default fn resolves to `{}` (NOT undefined). Services that await `.create()`
  // and read `.id` of the result get an undefined that the next mocked call
  // tolerates, instead of TypeError-crashing on `undefined.id`.
  const makeModel = () => new Proxy({}, {
    get(target: Record<string, ReturnType<typeof vi.fn>>, method: string) {
      if (!(method in target)) target[method] = vi.fn().mockResolvedValue({})
      return target[method]
    },
  }) as Record<string, ReturnType<typeof vi.fn>>

  let proxy: Record<string, unknown>
  const mockPrisma: Record<string, unknown> = {
    $transaction: vi.fn((fn: unknown) => typeof fn === 'function' ? (fn as (tx: unknown) => unknown)(proxy) : Promise.resolve(fn)),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  }
  proxy = new Proxy(mockPrisma, {
    get(target, prop: string) {
      if (prop in target) return target[prop]
      if (typeof prop !== 'string' || prop.startsWith('$') || prop.startsWith('_')) return undefined
      if (!modelCache.has(prop)) modelCache.set(prop, makeModel())
      return modelCache.get(prop)
    },
    // Expose lazily-synthesized model mocks as enumerable own keys so
    // Object.values(prisma) in resetMocks() reaches them. Without these traps
    // the model-method mock queues (mockResolvedValueOnce) are never reset
    // between test files, and stale queued values bleed across the suite.
    ownKeys(target) {
      return [...new Set([...Reflect.ownKeys(target), ...modelCache.keys()])]
    },
    getOwnPropertyDescriptor(target, prop: string) {
      if (prop in target) return Reflect.getOwnPropertyDescriptor(target, prop)
      if (modelCache.has(prop)) {
        return { enumerable: true, configurable: true, value: modelCache.get(prop) }
      }
      return undefined
    },
  })
  // Scoped-Prisma exports (tenant-isolation Wave A): under the unit-test mock the raw
  // base client and the scoped-tx shim collapse onto the same proxy — scoping is a
  // runtime concern proven by the integration suite, not the mocked unit tests.
  const scopedTransaction = (fn: unknown) =>
    typeof fn === 'function' ? (fn as (tx: unknown) => unknown)(proxy) : Promise.resolve(fn)
  return { prisma: proxy, __basePrismaUnsafe: proxy, scopedTransaction }
})

// Mock logger to silence output during tests
vi.mock('../lib/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: process.env.DEBUG_TEST ? console.error : vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock CSRF middleware to pass through in tests
vi.mock('../middleware/csrf.js', () => ({
  csrfProtection: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

// Mock replay-protection middleware (added post-launch); tests don't send
// X-Request-Nonce / X-Request-Timestamp headers, so default-strict mode would
// 400 every request. Pass through globally; individual tests can re-mock to
// exercise the middleware itself.
vi.mock('../middleware/replay-protection.js', () => ({
  replayProtection: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

// Mock subscription-gate factories to pass through. Without this the global
// prisma-Proxy returns undefined for `business.findUnique`, which makes
// resolveBusinessPlan return FREE → every paid-tier route 402s. Tests of the
// gate itself re-import the real module via importOriginal (see
// storefront-proof.test.ts for the pattern).
vi.mock('../middleware/subscription-gate.js', () => {
  const passthrough = (_req: unknown, _res: unknown, next: () => void) => next()
  return {
    requirePlan: () => passthrough,
    requireFeature: () => passthrough,
    requireQuota: () => passthrough,
  }
})

// Mock rate limiters to pass through in tests
vi.mock('../middleware/rate-limit.js', () => {
  const passthrough = (_req: unknown, _res: unknown, next: () => void) => next()
  return {
    apiRateLimiter: passthrough,
    authRateLimiter: passthrough,
    switchBusinessRateLimiter: passthrough,
    otpRateLimiter: passthrough,
    sensitiveRateLimiter: passthrough,
    sensitiveMutationLimiter: passthrough,
    couponValidateRateLimiter: passthrough,
    couponIpRateLimiter: passthrough,
    devLoginRateLimiter: passthrough,
    userMutationLimiter: passthrough,
    createRateLimiter: () => passthrough,
  }
})

// Mock razorpay (not installed in test env)
vi.mock('razorpay', () => ({
  default: vi.fn().mockImplementation(() => ({
    orders: { create: vi.fn() },
    payments: { fetch: vi.fn() },
    subscriptions: { create: vi.fn(), fetch: vi.fn(), cancel: vi.fn() },
  })),
}))

// Mock token blacklist
vi.mock('../lib/token-blacklist.js', () => ({
  blacklistToken: vi.fn(),
  isBlacklisted: vi.fn().mockReturnValue(false),
  isUserBlacklisted: vi.fn().mockReturnValue(false),
  blacklistUser: vi.fn(),
}))
