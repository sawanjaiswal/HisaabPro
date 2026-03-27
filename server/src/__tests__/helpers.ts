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
    delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
  }
}

/** Raw supertest (no auth) */
export function anonAgent(app: Express) {
  return {
    get: (url: string) => request(app).get(url),
    post: (url: string) => request(app).post(url),
    put: (url: string) => request(app).put(url),
    delete: (url: string) => request(app).delete(url),
  }
}

// ─── Mock Helpers ────────────────────────────────────────────────────────────

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

/** Setup auth middleware to pass — mocks user.findUnique to return active user */
export function mockAuthPass() {
  mockPrisma.user.findUnique.mockResolvedValue({
    id: TEST_USER.userId,
    isSuspended: false,
    isActive: true,
  })
}

/** Setup permission middleware to pass — mocks businessUser.findUnique as owner */
export function mockOwnerPermission() {
  mockAuthPass()
  mockPrisma.businessUser.findUnique.mockResolvedValue(TEST_OWNER_BU)
}

/** Setup permission middleware for staff with specific permissions */
export function mockStaffPermission(permissions?: string[]) {
  mockAuthPass()
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
