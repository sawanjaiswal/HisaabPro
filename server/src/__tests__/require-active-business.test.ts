/**
 * requireActiveBusiness middleware — Phase 6 #138 PR1 row 23 + A01.1.
 *
 * Exhaustive coverage of the tenancy gate at middleware/require-active-business.ts.
 * The gate is the SINGLE chokepoint that blocks suspended firms / suspended
 * members from reaching any tenant-scoped router — every party, payment,
 * dashboard, product and report request flows through it. A bug here is
 * cross-tenant data exposure.
 *
 *   - NO_BUSINESS        — JWT has no businessId (user removed from all firms)
 *   - NO_MEMBERSHIP      — BusinessUser row not found (kicked / never invited)
 *   - MEMBER_SUSPENDED   — BusinessUser.suspendedAt is set
 *   - FIRM_SUSPENDED     — Business.suspendedAt set OR Business.isActive=false
 *   - 200 pass-through   — healthy membership in active firm
 *   - A01.1 regression   — middleware MUST filter by `req.user.userId`
 *                          (reading `.id` returns `undefined` which Prisma
 *                          drops as a no-op, leaking the FIRST member of
 *                          the target firm regardless of caller identity)
 *
 * We exercise the middleware via `GET /api/parties` because:
 *   - It mounts `requireActiveBusiness` immediately after `auth` (party.ts:46)
 *   - It has no extra blocking middleware that would mask gate behavior
 *   - The route handler is mocked away (we never let it run)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../app.js'
import {
  authAgent,
  mockAuthPass,
  resetMocks,
  getMockPrisma,
  generateTestToken,
  TEST_USER,
} from './helpers.js'
import request from 'supertest'

const app = createApp()

beforeEach(() => {
  resetMocks()
  vi.clearAllMocks()
})

describe('requireActiveBusiness — gate coverage', () => {
  // ─── Failure modes ──────────────────────────────────────────────────────────

  it('returns 403 NO_BUSINESS when the JWT has no businessId', async () => {
    mockAuthPass()
    // Issue a token where businessId is empty string — auth.ts:75 normalises
    // missing businessId to '' so this is the realistic "user has no firms"
    // state, not a malformed token.
    const token = generateTestToken({ businessId: '' })

    const res = await request(app).get('/api/parties').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('NO_BUSINESS')
  })

  it('returns 403 NO_MEMBERSHIP when the BusinessUser row does not exist', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    mockPrisma.businessUser.findFirst.mockResolvedValue(null)

    const res = await authAgent(app).get('/api/parties')

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('NO_MEMBERSHIP')
  })

  it('returns 403 MEMBER_SUSPENDED when BusinessUser.suspendedAt is set', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    mockPrisma.businessUser.findFirst.mockResolvedValue({
      role: 'staff',
      suspendedAt: new Date('2026-05-01T00:00:00Z'),
      business: { suspendedAt: null, isActive: true },
    })

    const res = await authAgent(app).get('/api/parties')

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('MEMBER_SUSPENDED')
  })

  it('returns 403 FIRM_SUSPENDED when Business.suspendedAt is set', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    mockPrisma.businessUser.findFirst.mockResolvedValue({
      role: 'owner',
      suspendedAt: null,
      business: { suspendedAt: new Date('2026-05-01T00:00:00Z'), isActive: true },
    })

    const res = await authAgent(app).get('/api/parties')

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FIRM_SUSPENDED')
  })

  it('returns 403 FIRM_SUSPENDED when Business.isActive=false (legacy hard-disable)', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    mockPrisma.businessUser.findFirst.mockResolvedValue({
      role: 'owner',
      suspendedAt: null,
      business: { suspendedAt: null, isActive: false },
    })

    const res = await authAgent(app).get('/api/parties')

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FIRM_SUSPENDED')
  })

  it('prefers MEMBER_SUSPENDED over FIRM_SUSPENDED when both are set', async () => {
    // Order in the middleware: member-check first, then firm-check.
    // Rationale: surface the user-actionable state ("your access was paused")
    // before the firm-wide state ("the firm is offline").
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    mockPrisma.businessUser.findFirst.mockResolvedValue({
      role: 'staff',
      suspendedAt: new Date('2026-05-01T00:00:00Z'),
      business: { suspendedAt: new Date('2026-05-02T00:00:00Z'), isActive: true },
    })

    const res = await authAgent(app).get('/api/parties')

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('MEMBER_SUSPENDED')
  })

  // ─── 401 path ───────────────────────────────────────────────────────────────

  it('returns 401 when no auth token is presented (auth middleware short-circuits before gate)', async () => {
    const res = await request(app).get('/api/parties')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  // ─── Pass-through ───────────────────────────────────────────────────────────

  it('passes through to the route handler when membership is healthy and firm is active', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    mockPrisma.businessUser.findFirst.mockResolvedValue({
      role: 'owner',
      suspendedAt: null,
      business: { suspendedAt: null, isActive: true },
    })
    mockPrisma.party.findMany.mockResolvedValue([])
    mockPrisma.party.count.mockResolvedValue(0)
    mockPrisma.party.aggregate.mockResolvedValue({ _sum: { outstandingBalance: 0 } })
    mockPrisma.party.groupBy.mockResolvedValue([])

    const res = await authAgent(app).get('/api/parties')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  // ─── A01.1 — security regression guard ──────────────────────────────────────

  it('A01.1 — gate MUST filter by userId from JWT (regression guard against IDOR)', async () => {
    // The bug: an earlier draft of the middleware read `req.user.id` instead
    // of `req.user.userId`. The AuthRequest['user'] shape has no `.id`, so
    // the value was `undefined`. Prisma's "undefined = no-op" then dropped
    // the userId predicate from the WHERE clause, returning the FIRST
    // BusinessUser for the target businessId — regardless of caller. That
    // is a cross-tenant IDOR with FIRM_SUSPENDED gate as the leak surface.
    //
    // This test pins the fix: the SELECT MUST carry a defined string userId.
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    mockPrisma.businessUser.findFirst.mockResolvedValue({
      role: 'owner',
      suspendedAt: null,
      business: { suspendedAt: null, isActive: true },
    })
    mockPrisma.party.findMany.mockResolvedValue([])
    mockPrisma.party.count.mockResolvedValue(0)
    mockPrisma.party.aggregate.mockResolvedValue({ _sum: { outstandingBalance: 0 } })
    mockPrisma.party.groupBy.mockResolvedValue([])

    await authAgent(app).get('/api/parties')

    expect(mockPrisma.businessUser.findFirst).toHaveBeenCalledTimes(1)
    const callArg = mockPrisma.businessUser.findFirst.mock.calls[0]?.[0] as {
      where: { userId: string | undefined; businessId: string | undefined }
    }
    expect(callArg.where.userId).toBe(TEST_USER.userId)
    expect(callArg.where.businessId).toBe(TEST_USER.businessId)
    // Negative assertion — userId must be a real string, never undefined.
    // If this ever flips to undefined the gate becomes an IDOR.
    expect(callArg.where.userId).not.toBeUndefined()
    expect(typeof callArg.where.userId).toBe('string')
  })

  it('A01.1 — userId predicate is the actual caller, not the first member of the firm', async () => {
    // Even if multiple BusinessUser rows exist for the same business, the
    // gate's findFirst MUST pass userId in the WHERE clause so Prisma
    // returns only the caller's row — never another member's.
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    mockPrisma.businessUser.findFirst.mockResolvedValue({
      role: 'owner',
      suspendedAt: null,
      business: { suspendedAt: null, isActive: true },
    })
    mockPrisma.party.findMany.mockResolvedValue([])
    mockPrisma.party.count.mockResolvedValue(0)
    mockPrisma.party.aggregate.mockResolvedValue({ _sum: { outstandingBalance: 0 } })
    mockPrisma.party.groupBy.mockResolvedValue([])

    // Different caller — must result in a different userId filter.
    const otherCaller = generateTestToken({
      userId: 'attacker-user-2',
      businessId: TEST_USER.businessId,
    })
    await request(app).get('/api/parties').set('Authorization', `Bearer ${otherCaller}`)

    const callArg = mockPrisma.businessUser.findFirst.mock.calls[0]?.[0] as {
      where: { userId: string; businessId: string }
    }
    expect(callArg.where.userId).toBe('attacker-user-2')
    expect(callArg.where.businessId).toBe(TEST_USER.businessId)
  })
})
