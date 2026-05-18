/**
 * Businesses suspend/reactivate routes — Phase 6 #138 PR2 acceptance tests.
 *
 * Covers POST /api/businesses/:id/suspend + /reactivate:
 *   - owner succeeds with 200 + AuditLog row written
 *   - non-owner blocked with 403 OWNER_REQUIRED
 *   - cross-tenant path-param blocked with 403 FORBIDDEN (Business mismatch)
 *   - validation rejects missing/empty reason on suspend
 *   - idempotent re-suspend / re-reactivate is a 200 no-op without a new
 *     audit row
 *
 * PR3 update — both routes now sit behind requireRecentPin('mutation'). Tests
 * that should reach the handler must (a) mock UserAppSettings.pinHash so the
 * middleware's pf-fingerprint compare has something to hash against, and
 * (b) carry a valid pin_gate_grace cookie minted via buildGraceCookie() with
 * the same pinHash. Helper: seedPinGrace() returns { cookie, pinHash } and
 * the test installs both on the agent.
 *
 * Test architecture per server/src/__tests__/setup.ts — Prisma is auto-mocked
 * (Proxy stubs every model.method with vi.fn()). The suspend.service uses
 * `prisma.$transaction(async tx => ...)` which the setup mock unwraps by
 * invoking the callback with the proxy itself, so our model-method mocks
 * fire transparently.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import {
  authAgent,
  anonAgent,
  generateTestToken,
  mockOwnerPermission,
  mockStaffPermission,
  resetMocks,
  getMockPrisma,
  TEST_USER,
} from './helpers.js'
import { hashPin } from '../services/security-pin/pin-hash.util.js'
import { buildGraceCookie, COOKIE_NAME } from '../services/security-pin/pin-grace-cookie.js'

const app = createApp()

const SUSPEND_PATH = `/api/businesses/${TEST_USER.businessId}/suspend`
const REACTIVATE_PATH = `/api/businesses/${TEST_USER.businessId}/reactivate`

/**
 * PR3 — mint a valid pin_gate_grace cookie + stub UserAppSettings.pinHash so
 * requireRecentPin('mutation') passes for the TEST_USER on the active
 * business. Call AFTER mockOwnerPermission() / mockStaffPermission() (it
 * stacks on top of those without resetting other mocks).
 */
function seedPinGrace(): { cookieHeader: string } {
  const mp = getMockPrisma()
  const pinHash = hashPin('1234')
  mp.userAppSettings.findUnique.mockResolvedValue({ pinHash })
  const cookieValue = buildGraceCookie(TEST_USER.userId, TEST_USER.businessId, 'mutation', pinHash)
  return { cookieHeader: `${COOKIE_NAME}=${cookieValue}` }
}

/** Like authAgent but ALSO attaches a fresh pin_gate_grace cookie. */
function pinAuthAgent(method: 'post', url: string) {
  const token = generateTestToken()
  const { cookieHeader } = seedPinGrace()
  return request(app)[method](url)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', cookieHeader)
}

beforeEach(() => {
  resetMocks()
  vi.clearAllMocks()
})

// ─── POST /api/businesses/:id/suspend ─────────────────────────────────────────

describe('POST /api/businesses/:id/suspend', () => {
  it('returns 200 and writes AuditLog row when owner suspends an active firm', async () => {
    mockOwnerPermission()
    const mockPrisma = getMockPrisma()
    // Active firm — suspend will flip suspendedAt and write the audit row.
    mockPrisma.business.findUnique.mockResolvedValue({
      id: TEST_USER.businessId, name: 'Acme', suspendedAt: null,
    })
    mockPrisma.business.update.mockResolvedValue({
      id: TEST_USER.businessId, name: 'Acme', suspendedAt: new Date(),
    })
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' })

    const res = await pinAuthAgent('post', SUSPEND_PATH).send({ reason: 'maintenance window' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.business.suspendedAt).not.toBeNull()
    expect(mockPrisma.business.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: TEST_USER.businessId },
      data: { suspendedAt: expect.any(Date) },
    }))
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        businessId: TEST_USER.businessId,
        action: 'SUSPEND_FIRM',
        entityType: 'Business',
        entityId: TEST_USER.businessId,
        userId: TEST_USER.userId,
        reason: 'maintenance window',
      }),
    }))
  })

  it('returns 403 OWNER_REQUIRED when caller is a staff member, not the owner', async () => {
    mockStaffPermission()
    const mockPrisma = getMockPrisma()

    const res = await authAgent(app).post(SUSPEND_PATH).send({ reason: 'attempted suspend' })

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('OWNER_REQUIRED')
    expect(mockPrisma.business.update).not.toHaveBeenCalled()
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('returns 401 without an auth token', async () => {
    const res = await anonAgent(app).post(SUSPEND_PATH).send({ reason: 'noauth' })

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when reason is missing', async () => {
    mockOwnerPermission()

    // PR3 — validate runs AFTER requireRecentPin; seed the cookie so the
    // request reaches the Zod gate.
    const res = await pinAuthAgent('post', SUSPEND_PATH).send({})

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when reason is empty string', async () => {
    mockOwnerPermission()

    const res = await pinAuthAgent('post', SUSPEND_PATH).send({ reason: '   ' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 403 when path :id does not match the JWT businessId (cross-tenant guard)', async () => {
    mockOwnerPermission()

    // PR3 — the path-param mismatch check lives in the handler, AFTER
    // requireRecentPin('mutation'). Cookie is bound to TEST_USER.businessId
    // (the JWT business), which is correct: the gate passes, then the
    // handler's own cross-tenant check fires with the path mismatch.
    const res = await pinAuthAgent('post', '/api/businesses/biz-other/suspend')
      .send({ reason: 'cross-tenant attempt' })

    // requireOwner first verifies the caller is owner of req.user.businessId.
    // The path-param mismatch check then rejects with 403 FORBIDDEN.
    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  it('is idempotent — re-suspending an already-suspended firm returns 200 with NO new audit row', async () => {
    mockOwnerPermission()
    const mockPrisma = getMockPrisma()
    const already = new Date('2026-05-01T00:00:00Z')
    mockPrisma.business.findUnique.mockResolvedValue({
      id: TEST_USER.businessId, name: 'Acme', suspendedAt: already,
    })

    const res = await pinAuthAgent('post', SUSPEND_PATH).send({ reason: 'second call' })

    expect(res.status).toBe(200)
    expect(mockPrisma.business.update).not.toHaveBeenCalled()
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled()
  })
})

// ─── POST /api/businesses/:id/reactivate ──────────────────────────────────────

describe('POST /api/businesses/:id/reactivate', () => {
  it('returns 200 and writes AuditLog row when owner reactivates a suspended firm', async () => {
    mockOwnerPermission()
    const mockPrisma = getMockPrisma()
    mockPrisma.business.findUnique.mockResolvedValue({
      id: TEST_USER.businessId, name: 'Acme', suspendedAt: new Date(),
    })
    mockPrisma.business.update.mockResolvedValue({
      id: TEST_USER.businessId, name: 'Acme', suspendedAt: null,
    })
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-2' })

    const res = await pinAuthAgent('post', REACTIVATE_PATH).send({})

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.business.suspendedAt).toBeNull()
    expect(mockPrisma.business.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { suspendedAt: null },
    }))
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'REACTIVATE_FIRM' }),
    }))
  })

  it('returns 403 when staff attempts to reactivate', async () => {
    mockStaffPermission()

    const res = await authAgent(app).post(REACTIVATE_PATH).send({})

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('OWNER_REQUIRED')
  })

  it('is idempotent — reactivating an already-active firm returns 200 with NO new audit row', async () => {
    mockOwnerPermission()
    const mockPrisma = getMockPrisma()
    mockPrisma.business.findUnique.mockResolvedValue({
      id: TEST_USER.businessId, name: 'Acme', suspendedAt: null,
    })

    const res = await pinAuthAgent('post', REACTIVATE_PATH).send({})

    expect(res.status).toBe(200)
    expect(mockPrisma.business.update).not.toHaveBeenCalled()
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled()
  })
})
