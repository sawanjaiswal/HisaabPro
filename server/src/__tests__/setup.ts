/**
 * Global test setup — runs before all test files.
 * Mocks Prisma client to prevent real DB connections.
 */

import { vi } from 'vitest'

// Mock Prisma globally — every test gets a fresh mock
vi.mock('../lib/prisma.js', () => {
  const mockPrisma = {
    user: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    business: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    businessUser: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    party: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    partyAddress: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    product: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    document: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    documentLineItem: { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    payment: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    paymentAllocation: { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    stockMovement: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    category: { findMany: vi.fn(), create: vi.fn() },
    unit: { findMany: vi.fn(), create: vi.fn() },
    taxCategory: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    role: { findUnique: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn((fn: unknown) => typeof fn === 'function' ? fn(mockPrisma) : Promise.resolve(fn)),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  }
  return { prisma: mockPrisma }
})

// Mock logger to silence output during tests
vi.mock('../lib/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock CSRF middleware to pass through in tests
vi.mock('../middleware/csrf.js', () => ({
  csrfProtection: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

// Mock rate limiters to pass through in tests
vi.mock('../middleware/rate-limit.js', () => {
  const passthrough = (_req: unknown, _res: unknown, next: () => void) => next()
  return {
    apiRateLimiter: passthrough,
    authRateLimiter: passthrough,
    otpRateLimiter: passthrough,
    sensitiveRateLimiter: passthrough,
    sensitiveMutationLimiter: passthrough,
    couponValidateRateLimiter: passthrough,
    couponIpRateLimiter: passthrough,
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
