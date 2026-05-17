/**
 * Loyalty #125 Program CRUD — route tests.
 *
 * Covers GET /api/loyalty/program, PUT /api/loyalty/program. Tests:
 *  - 401 without auth
 *  - 403 for staff without loyalty.view / loyalty.configure
 *  - 200 happy path GET
 *  - 200 happy path PUT (upsert)
 *  - 400 negative accrualRateBps (S2 cap)
 *  - 400 oversized expiryMonths (cap [1,60])
 *  - .strict() rejects extra keys
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

vi.mock('../middleware/rate-limit.js', () => {
  const pass = (_req: unknown, _res: unknown, next: () => void) => next()
  return {
    createRateLimiter: () => pass,
    authRateLimiter: pass,
    otpRateLimiter: pass,
    apiRateLimiter: pass,
    sensitiveMutationLimiter: pass,
    couponValidateRateLimiter: pass,
    couponIpRateLimiter: pass,
    devLoginRateLimiter: pass,
    userMutationLimiter: pass,
  }
})

const app = createApp()

const PROGRAM_ROW = {
  id: 'lp-1',
  businessId: 'biz-test-1',
  enabled: true,
  accrualRateBps: 100,
  accrualMinSpendPaise: 0,
  redemptionUnit: 1,
  redemptionPaisePerUnit: 100,
  expiryMonths: 12,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
}

beforeEach(() => {
  resetMocks()
})

describe('GET /api/loyalty/program', () => {
  it('returns 401 without auth', async () => {
    const res = await anonAgent(app).get('/api/loyalty/program')
    expect(res.status).toBe(401)
  })

  it('returns 403 for staff without loyalty.view', async () => {
    mockStaffPermission([])
    const res = await authAgent(app).get('/api/loyalty/program')
    expect(res.status).toBe(403)
  })

  it('returns 200 + program for owner', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.loyaltyProgram.findUnique.mockResolvedValue(PROGRAM_ROW)
    const res = await authAgent(app).get('/api/loyalty/program')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.program.id).toBe('lp-1')
    expect(res.body.data.program.accrualRateBps).toBe(100)
  })

  it('returns 200 + null when no program', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.loyaltyProgram.findUnique.mockResolvedValue(null)
    const res = await authAgent(app).get('/api/loyalty/program')
    expect(res.status).toBe(200)
    expect(res.body.data.program).toBeNull()
  })
})

describe('PUT /api/loyalty/program', () => {
  const VALID = {
    enabled: true,
    accrualRateBps: 200,
    accrualMinSpendPaise: 10000,
    redemptionUnit: 1,
    redemptionPaisePerUnit: 100,
    expiryMonths: 12,
  }

  it('returns 401 without auth', async () => {
    const res = await anonAgent(app).put('/api/loyalty/program').send(VALID)
    expect(res.status).toBe(401)
  })

  it('returns 403 for staff without loyalty.configure', async () => {
    mockStaffPermission(['loyalty.view'])
    const res = await authAgent(app).put('/api/loyalty/program').send(VALID)
    expect(res.status).toBe(403)
  })

  it('returns 200 on upsert (owner)', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.loyaltyProgram.findUnique.mockResolvedValue(null) // no existing → fresh enable
    mp.loyaltyProgram.upsert.mockResolvedValue({ ...PROGRAM_ROW, accrualRateBps: 200 })
    const res = await authAgent(app).put('/api/loyalty/program').send(VALID)
    expect(res.status).toBe(200)
    expect(res.body.data.program.accrualRateBps).toBe(200)
    expect(mp.loyaltyProgram.upsert).toHaveBeenCalledTimes(1)
  })

  it('returns 400 on negative accrualRateBps (S2 cap)', async () => {
    mockOwnerPermission()
    const res = await authAgent(app)
      .put('/api/loyalty/program')
      .send({ ...VALID, accrualRateBps: -1 })
    expect(res.status).toBe(400)
  })

  it('returns 400 on accrualRateBps > 10000 (S2 cap)', async () => {
    mockOwnerPermission()
    const res = await authAgent(app)
      .put('/api/loyalty/program')
      .send({ ...VALID, accrualRateBps: 10_001 })
    expect(res.status).toBe(400)
  })

  it('returns 400 on expiryMonths > 60', async () => {
    mockOwnerPermission()
    const res = await authAgent(app)
      .put('/api/loyalty/program')
      .send({ ...VALID, expiryMonths: 61 })
    expect(res.status).toBe(400)
  })

  it('returns 400 on extra keys (.strict)', async () => {
    mockOwnerPermission()
    const res = await authAgent(app)
      .put('/api/loyalty/program')
      .send({ ...VALID, leakedKey: 'no' })
    expect(res.status).toBe(400)
  })
})
