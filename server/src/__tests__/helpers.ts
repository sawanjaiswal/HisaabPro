/**
 * Test helpers — auth token generation, mock factories, supertest setup.
 */

import { vi } from 'vitest'
import jwt from 'jsonwebtoken'
import type { Express } from 'express'
import request from 'supertest'
import { prisma } from '../lib/prisma.js'

const JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long'

// ─── Test Data ───────────────────────────────────────────────────────────────

export const TEST_USER = {
  userId: 'user-test-1',
  phone: '9876543210',
  businessId: 'biz-test-1',
}

export const TEST_OWNER_BU = {
  role: 'owner',
  status: 'ACTIVE',
  isActive: true,
  roleRef: { permissions: [] },
}

export const TEST_STAFF_BU = {
  role: 'staff',
  status: 'ACTIVE',
  isActive: true,
  roleRef: { permissions: ['invoicing.view', 'invoicing.create', 'payments.record', 'parties.create', 'parties.edit', 'inventory.view'] },
}

// ─── Auth Helpers ────────────────────────────────────────────────────────────

/** Generate a valid access token for test requests */
export function generateTestToken(overrides?: Partial<typeof TEST_USER>) {
  const payload = { ...TEST_USER, ...overrides, type: 'access' }
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' })
}

/** Generate a valid refresh token */
export function generateTestRefreshToken(overrides?: Partial<typeof TEST_USER>) {
  const payload = { ...TEST_USER, ...overrides, type: 'refresh' }
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' })
}

/** Create a supertest agent with auth token pre-set */
export function authAgent(app: Express, tokenOverrides?: Partial<typeof TEST_USER>) {
  const token = generateTestToken(tokenOverrides)
  return {
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
  }
}

/** Raw supertest (no auth) */
export function anonAgent(app: Express) {
  return {
    get: (url: string) => request(app).get(url),
    post: (url: string) => request(app).post(url),
    put: (url: string) => request(app).put(url),
    patch: (url: string) => request(app).patch(url),
    delete: (url: string) => request(app).delete(url),
  }
}

// ─── Mock Helpers ────────────────────────────────────────────────────────────

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

/**
 * Setup auth middleware to pass — mocks user.findUnique to return active user.
 *
 * Phase 6 #138 PR2 — ALSO installs a default-healthy active-business mock
 * (mockActiveBusinessPass) so any test that authenticates a user can also
 * traverse the `requireActiveBusiness` gate on tenant-scoped routes
 * (parties, payments, dashboard, products, reports) without further setup.
 *
 * Tests that exercise the gate's failure modes (NO_MEMBERSHIP /
 * FIRM_SUSPENDED / MEMBER_SUSPENDED) override `businessUser.findFirst`
 * AFTER calling this helper — the later `mockResolvedValue` wins.
 */
export function mockAuthPass() {
  mockPrisma.user.findUnique.mockResolvedValue({
    id: TEST_USER.userId,
    isSuspended: false,
    isActive: true,
  })
  mockActiveBusinessPass('owner')
}

/**
 * Phase 6 #138 PR2 — make requireActiveBusiness pass.
 *
 * The gate (middleware/require-active-business.ts) calls
 * `prisma.businessUser.findFirst({ where:{ userId, businessId } })` and
 * checks for membership + member-suspendedAt + business-suspendedAt. This
 * helper installs a default "healthy active owner" mock. Individual tests
 * that exercise the gate failure modes override `findFirst` themselves.
 *
 * Idempotent — safe to call multiple times in a single test setup.
 */
export function mockActiveBusinessPass(role: 'owner' | 'staff' = 'owner') {
  mockPrisma.businessUser.findFirst.mockResolvedValue({
    role,
    suspendedAt: null,
    business: { suspendedAt: null, isActive: true },
  })
}

/** Setup permission middleware to pass — mocks businessUser.findUnique as owner */
export function mockOwnerPermission() {
  mockAuthPass()
  mockActiveBusinessPass('owner')
  mockPrisma.businessUser.findUnique.mockResolvedValue(TEST_OWNER_BU)
  // Plan-gate mocks: BUSINESS plan (covers requirePlan('BUSINESS')/('PRO') middleware)
  mockPrisma.business.findUnique.mockResolvedValue({ createdAt: new Date() })
  mockPrisma.subscription.findUnique.mockResolvedValue({ planTier: 'BUSINESS', status: 'ACTIVE' })
}

/** Setup permission middleware for staff with specific permissions */
export function mockStaffPermission(permissions?: string[]) {
  mockAuthPass()
  mockActiveBusinessPass('staff')
  mockPrisma.businessUser.findUnique.mockResolvedValue(
    permissions
      ? { ...TEST_STAFF_BU, roleRef: { permissions } }
      : TEST_STAFF_BU
  )
}

/** Reset all prisma mocks */
export function resetMocks() {
  for (const model of Object.values(mockPrisma)) {
    if (typeof model === 'object' && model !== null) {
      for (const fn of Object.values(model)) {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          fn.mockReset()
        }
      }
    }
  }
}

/** Get the mocked prisma for direct mock setup */
export function getMockPrisma() {
  return mockPrisma
}
