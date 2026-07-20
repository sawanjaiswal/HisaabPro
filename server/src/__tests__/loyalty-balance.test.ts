/**
 * Test 12.16 — GET /loyalty/balance/:partyId cross-tenant 404 (NEW_S1).
 *
 * Architecture §6.3 / Security audit NEW_S1: a probe with a partyId that
 * belongs to a different tenant must return 404 PARTY_NOT_FOUND, not 200-with-
 * empty-balance. Treating it as "empty balance" would let an attacker walk the
 * id space and confirm party existence.
 *
 * Also covers 401, 403 (no perm), happy-path 200.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../app.js'
import {
  authAgent,
  anonAgent,
  mockOwnerPermission,
  mockStaffPermission,
  resetMocks,
  getMockPrisma,
} from './helpers.js'

vi.mock('../middleware/rate-limit.js', async (importOriginal) => {
  const { rateLimitPassthrough } = await import('./helpers.js')
  return rateLimitPassthrough(importOriginal)
})

const app = createApp()

beforeEach(() => {
  resetMocks()
})

describe('GET /api/loyalty/balance/:partyId — test 12.16', () => {
  it('returns 401 without auth', async () => {
    const res = await anonAgent(app).get('/api/loyalty/balance/p-1')
    expect(res.status).toBe(401)
  })

  it('returns 403 for staff without loyalty.view', async () => {
    mockStaffPermission([])
    const res = await authAgent(app).get('/api/loyalty/balance/p-1')
    expect(res.status).toBe(403)
  })

  it('returns 404 for cross-tenant partyId (NEW_S1)', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    // assertPartyInTenant: findFirst({ where: { id, businessId } }) returns null
    mp.party.findFirst.mockResolvedValue(null)

    const res = await authAgent(app).get('/api/loyalty/balance/p-other-tenant')
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error?.code).toBe('PARTY_NOT_FOUND')
    expect(mp.loyaltyLedger.groupBy).not.toHaveBeenCalled()
  })

  it('returns 200 with balance shape for in-tenant partyId', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.party.findFirst.mockResolvedValue({ id: 'p-1' })
    mp.loyaltyLedger.groupBy.mockResolvedValue([
      { type: 'AC', _sum: { delta: 500 } },
      { type: 'RD', _sum: { delta: -120 } },
    ])
    mp.loyaltyLedger.aggregate
      // current (unexpired)
      .mockResolvedValueOnce({ _sum: { delta: 380 } })
      // expiring soon
      .mockResolvedValueOnce({ _sum: { delta: 40 } })

    const res = await authAgent(app).get('/api/loyalty/balance/p-1')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual({
      partyId: 'p-1',
      currentPoints: 380,
      lifetimeEarned: 500,
      lifetimeRedeemed: 120,
      expiringSoonPoints: 40,
      expiringSoonDays: 30,
    })
  })
})
