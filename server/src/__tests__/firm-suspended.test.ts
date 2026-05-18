/**
 * FIRM_SUSPENDED gate — Phase 6 #138 PR2 acceptance test.
 *
 * Proves the architecture §3 contract: once `Business.suspendedAt` is set,
 * every tenant-scoped read/write returns 403 FIRM_SUSPENDED via the
 * `requireActiveBusiness` middleware.
 *
 * The middleware (middleware/require-active-business.ts) runs after `auth`
 * and SELECTs the BusinessUser row joined to Business; if the firm's
 * `suspendedAt` is set OR `isActive=false`, it short-circuits with 403
 * FIRM_SUSPENDED. We exercise the gate against `/api/parties` (one of the
 * five tenant-scoped routers re-wired in this PR) — the route handler must
 * never run, so we assert ONLY on the gate response.
 *
 * Pairs with [member-suspended] (MEMBER_SUSPENDED) and the route-specific
 * tests in businesses-suspend.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../app.js'
import { authAgent, mockAuthPass, resetMocks, getMockPrisma, TEST_USER } from './helpers.js'

const app = createApp()

beforeEach(() => {
  resetMocks()
  vi.clearAllMocks()
})

describe('requireActiveBusiness — FIRM_SUSPENDED / MEMBER_SUSPENDED gates', () => {
  it('returns 403 FIRM_SUSPENDED on GET /api/parties when Business.suspendedAt is set', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    // requireActiveBusiness calls businessUser.findFirst (NOT findUnique) so
    // it can join in `business.suspendedAt` via the nested select. Membership
    // is healthy at the user level — only the firm is paused.
    mockPrisma.businessUser.findFirst.mockResolvedValue({
      role: 'owner',
      suspendedAt: null,
      business: { suspendedAt: new Date('2026-05-01T00:00:00Z'), isActive: true },
    })

    const res = await authAgent(app).get('/api/parties')

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('FIRM_SUSPENDED')
    // Route handler must not have run — no listParties query attempted.
    expect(mockPrisma.party.findMany).not.toHaveBeenCalled()
  })

  it('returns 403 MEMBER_SUSPENDED when BusinessUser.suspendedAt is set (firm still active)', async () => {
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
    expect(mockPrisma.party.findMany).not.toHaveBeenCalled()
  })

  it('returns 403 NO_MEMBERSHIP when the BusinessUser row does not exist', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    mockPrisma.businessUser.findFirst.mockResolvedValue(null)

    const res = await authAgent(app).get('/api/parties')

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('NO_MEMBERSHIP')
  })

  it('A01.1 counter-example — middleware MUST filter by userId (regression guard)', async () => {
    // This test documents the bug a previous version of the middleware had:
    // if the gate read `req.user.id` instead of `req.user.userId`, Prisma's
    // "undefined = no-op" semantics drops the userId predicate and returns
    // the FIRST BusinessUser for the business, regardless of caller.
    //
    // We prove the fix by asserting findFirst is called WITH a userId
    // predicate equal to TEST_USER.userId — not with `undefined`.
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    mockPrisma.businessUser.findFirst.mockResolvedValue({
      role: 'owner',
      suspendedAt: null,
      business: { suspendedAt: null, isActive: true },
    })
    // Also mock the listParties query so the request can reach 200.
    mockPrisma.party.findMany.mockResolvedValue([])
    mockPrisma.party.count.mockResolvedValue(0)
    mockPrisma.party.aggregate.mockResolvedValue({ _sum: { outstandingBalance: 0 } })
    mockPrisma.party.groupBy.mockResolvedValue([])

    await authAgent(app).get('/api/parties')

    expect(mockPrisma.businessUser.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: TEST_USER.userId,
          businessId: TEST_USER.businessId,
        }),
      }),
    )
    // Sanity: the where clause must NOT carry a literal `userId: undefined`
    // — that would be the bug.
    const call = mockPrisma.businessUser.findFirst.mock.calls[0]?.[0] as {
      where: { userId: string | undefined }
    }
    expect(call.where.userId).toBeDefined()
    expect(typeof call.where.userId).toBe('string')
  })

  it('passes through to the route handler when membership is healthy and firm is active', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    mockPrisma.businessUser.findFirst.mockResolvedValue({
      role: 'owner',
      suspendedAt: null,
      business: { suspendedAt: null, isActive: true },
    })
    // listParties runs 5 parallel queries: findMany, count, 2x aggregate, groupBy.
    // Mock all so the route handler completes without a 500.
    mockPrisma.party.findMany.mockResolvedValue([])
    mockPrisma.party.count.mockResolvedValue(0)
    mockPrisma.party.aggregate.mockResolvedValue({ _sum: { outstandingBalance: 0 } })
    mockPrisma.party.groupBy.mockResolvedValue([])

    const res = await authAgent(app).get('/api/parties')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})
