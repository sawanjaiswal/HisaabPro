/**
 * GET /api/auth/me — suspend state surfacing — Phase 6 #138 PR2.
 *
 * The /me response is the single source of truth the FE consults to render
 * the TenantChip and the "your access is paused" / "this firm has been
 * suspended" banners. PR2 widens the `getMe` projection to include:
 *
 *   businesses[i].suspendedAt          — when this user's membership was paused
 *   businesses[i].suspendedById        — who paused them
 *   businesses[i].businessSuspendedAt  — when the WHOLE firm was paused
 *
 * The acceptance gate (architecture §17.1) is: "GET /me reveals
 * `suspendedAt` for the calling user on the matching business row".
 *
 * NOTE: unlike auth.test.ts, this file does NOT mock `auth.service.js`. We
 * want the real `getMe()` to run against the auto-mocked prisma layer so we
 * exercise the actual projection — not just the fact that getMe is called.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../app.js'
import { authAgent, mockAuthPass, resetMocks, getMockPrisma, TEST_USER } from './helpers.js'

const app = createApp()

beforeEach(() => {
  resetMocks()
  vi.clearAllMocks()
})

describe('GET /api/auth/me — suspend state', () => {
  it('surfaces businessSuspendedAt on the active business when the firm is paused', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    const firmSuspendedAt = new Date('2026-05-10T12:00:00Z')
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      // auth middleware shape (first call)
      isSuspended: false,
      isActive: true,
    })
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      // getMe shape (second call) — includes businessUsers
      id: TEST_USER.userId,
      phone: TEST_USER.phone,
      name: 'Owner One',
      email: null,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      lastActiveBusinessId: TEST_USER.businessId,
      businessUsers: [{
        role: 'owner',
        status: 'ACTIVE',
        lastActiveAt: null,
        suspendedAt: null,
        suspendedById: null,
        roleRef: { id: null, name: null, permissions: [] },
        business: {
          id: TEST_USER.businessId,
          name: 'Acme',
          businessType: 'retail',
          suspendedAt: firmSuspendedAt,
        },
      }],
    })

    const res = await authAgent(app).get('/api/auth/me')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.businesses).toHaveLength(1)
    const biz = res.body.data.businesses[0]
    expect(biz.id).toBe(TEST_USER.businessId)
    expect(biz.suspendedAt).toBeNull()
    expect(biz.suspendedById).toBeNull()
    expect(new Date(biz.businessSuspendedAt).toISOString()).toBe(firmSuspendedAt.toISOString())
    // Active business object surfaces the same data.
    expect(new Date(res.body.data.activeBusiness.businessSuspendedAt).toISOString())
      .toBe(firmSuspendedAt.toISOString())
  })

  it('surfaces suspendedAt + suspendedById on the membership when the USER is paused (firm active)', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    const memberSuspendedAt = new Date('2026-05-11T09:30:00Z')
    mockPrisma.user.findUnique.mockResolvedValueOnce({ isSuspended: false, isActive: true })
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: TEST_USER.userId,
      phone: TEST_USER.phone,
      name: 'Staff One',
      email: null,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      lastActiveBusinessId: TEST_USER.businessId,
      businessUsers: [{
        role: 'staff',
        status: 'SUSPENDED',
        lastActiveAt: null,
        suspendedAt: memberSuspendedAt,
        suspendedById: 'owner-user-1',
        roleRef: { id: null, name: null, permissions: [] },
        business: {
          id: TEST_USER.businessId,
          name: 'Acme',
          businessType: 'retail',
          suspendedAt: null,
        },
      }],
    })

    const res = await authAgent(app).get('/api/auth/me')

    expect(res.status).toBe(200)
    const biz = res.body.data.businesses[0]
    expect(new Date(biz.suspendedAt).toISOString()).toBe(memberSuspendedAt.toISOString())
    expect(biz.suspendedById).toBe('owner-user-1')
    expect(biz.businessSuspendedAt).toBeNull()
  })

  it('returns suspendedAt=null + suspendedById=null + businessSuspendedAt=null for a healthy membership', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    mockPrisma.user.findUnique.mockResolvedValueOnce({ isSuspended: false, isActive: true })
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: TEST_USER.userId,
      phone: TEST_USER.phone,
      name: 'Owner',
      email: null,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      lastActiveBusinessId: TEST_USER.businessId,
      businessUsers: [{
        role: 'owner',
        status: 'ACTIVE',
        lastActiveAt: null,
        suspendedAt: null,
        suspendedById: null,
        roleRef: { id: null, name: null, permissions: [] },
        business: {
          id: TEST_USER.businessId,
          name: 'Acme',
          businessType: 'retail',
          suspendedAt: null,
        },
      }],
    })

    const res = await authAgent(app).get('/api/auth/me')

    expect(res.status).toBe(200)
    const biz = res.body.data.businesses[0]
    expect(biz.suspendedAt).toBeNull()
    expect(biz.suspendedById).toBeNull()
    expect(biz.businessSuspendedAt).toBeNull()
  })
})
