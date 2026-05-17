/**
 * Party CRM (#127) — Integration Tests
 * Covers GET /api/parties/tags, GET /api/parties/follow-ups, PATCH /api/parties/:id,
 * + ?tag= filter on GET /api/parties.
 *
 * Hits the curl-proof matrix from architecture §3.5-§3.6 / M2 (server-only
 * field rejection) and M3 (withinDays cap).
 *
 * Tests 12.13 (M2 server-only-field block) + 12.14 (M3 withinDays cap) are
 * named explicitly in the brief.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../app.js'
import {
  authAgent,
  anonAgent,
  mockOwnerPermission,
  mockStaffPermission,
  resetMocks,
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

vi.mock('../services/party.service.js', () => ({
  createParty: vi.fn(),
  listParties: vi.fn(),
  getParty: vi.fn(),
  updateParty: vi.fn(),
  patchParty: vi.fn(),
  deleteParty: vi.fn(),
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
  setPricing: vi.fn(),
  getPartyPricing: vi.fn(),
  listTagSummary: vi.fn(),
  getFollowUpsDue: vi.fn(),
}))

import * as partyService from '../services/party.service.js'

const app = createApp()

const FUTURE_ISO = new Date(Date.now() + 86400000 * 7).toISOString()
const PAST_ISO = new Date(Date.now() - 86400000 * 7).toISOString()

const MOCK_TAG_PAGE = {
  tags: [
    { tag: 'vip', partyCount: 4 },
    { tag: 'wholesale', partyCount: 12 },
  ],
  totalPartiesWithTags: 14,
  totalPartiesWithoutTags: 36,
}

const MOCK_FOLLOWUP_PAGE = {
  rows: [
    {
      id: 'p-1',
      name: 'Raju Traders',
      phone: '9876543210',
      lastContactedAt: PAST_ISO,
      followUpAt: FUTURE_ISO,
      daysOverdue: -7,
    },
  ],
  nextCursor: null,
  totalCount: 1,
}

const MOCK_PATCHED_PARTY = {
  id: 'p-1',
  name: 'Raju Traders',
  tags: ['vip'],
  followUpAt: FUTURE_ISO,
  lastContactedAt: PAST_ISO,
  updatedAt: new Date().toISOString(),
}

const MOCK_LIST_RESULT = {
  parties: [
    { id: 'p-1', name: 'Raju Traders', tags: ['vip'], isActive: true },
  ],
  pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
  summary: {
    totalParties: 1,
    totalReceivable: 0,
    totalPayable: 0,
    netOutstanding: 0,
    customersCount: 1,
    suppliersCount: 0,
    bothCount: 0,
  },
}

beforeEach(() => {
  resetMocks()
  vi.mocked(partyService.listTagSummary).mockReset()
  vi.mocked(partyService.getFollowUpsDue).mockReset()
  vi.mocked(partyService.patchParty).mockReset()
  vi.mocked(partyService.listParties).mockReset()
})

// ─── 12.1  GET /api/parties/tags ──────────────────────────────────────────

describe('GET /api/parties/tags', () => {
  it('returns tag summary (200, owner)', async () => {
    mockOwnerPermission()
    vi.mocked(partyService.listTagSummary).mockResolvedValue(MOCK_TAG_PAGE)

    const res = await authAgent(app).get('/api/parties/tags')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.tags).toHaveLength(2)
    expect(res.body.data.tags[0]).toEqual({ tag: 'vip', partyCount: 4 })
    expect(partyService.listTagSummary).toHaveBeenCalledWith('biz-test-1')
  })

  it('returns 401 without auth', async () => {
    const res = await anonAgent(app).get('/api/parties/tags')
    expect(res.status).toBe(401)
    expect(partyService.listTagSummary).not.toHaveBeenCalled()
  })

  it('returns 403 for staff without parties.view', async () => {
    mockStaffPermission([])
    const res = await authAgent(app).get('/api/parties/tags')
    expect(res.status).toBe(403)
    expect(partyService.listTagSummary).not.toHaveBeenCalled()
  })
})

// ─── 12.2  GET /api/parties/follow-ups ────────────────────────────────────

describe('GET /api/parties/follow-ups', () => {
  it('returns follow-up queue (200) when withinDays=30', async () => {
    mockOwnerPermission()
    vi.mocked(partyService.getFollowUpsDue).mockResolvedValue(MOCK_FOLLOWUP_PAGE)

    const res = await authAgent(app).get('/api/parties/follow-ups?withinDays=30')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.rows).toHaveLength(1)
    expect(res.body.data.rows[0].id).toBe('p-1')
    expect(partyService.getFollowUpsDue).toHaveBeenCalledWith(
      'biz-test-1',
      expect.objectContaining({ withinDays: 30 }),
    )
  })

  // Test 12.14 — M3 withinDays > 365 must reject with INVALID_WITHIN_DAYS_RANGE
  it('12.14 — returns 400 INVALID_WITHIN_DAYS_RANGE when withinDays=10000', async () => {
    mockOwnerPermission()

    const res = await authAgent(app).get('/api/parties/follow-ups?withinDays=10000')

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('INVALID_WITHIN_DAYS_RANGE')
    expect(partyService.getFollowUpsDue).not.toHaveBeenCalled()
  })

  it('returns 400 INVALID_WITHIN_DAYS_RANGE when withinDays=0', async () => {
    mockOwnerPermission()
    const res = await authAgent(app).get('/api/parties/follow-ups?withinDays=0')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_WITHIN_DAYS_RANGE')
    expect(partyService.getFollowUpsDue).not.toHaveBeenCalled()
  })

  it('returns 401 without auth', async () => {
    const res = await anonAgent(app).get('/api/parties/follow-ups?withinDays=30')
    expect(res.status).toBe(401)
  })
})

// ─── 12.3  PATCH /api/parties/:id (narrow CRM patch) ──────────────────────

describe('PATCH /api/parties/:id', () => {
  it('updates followUpAt + tags (200)', async () => {
    mockOwnerPermission()
    vi.mocked(partyService.patchParty).mockResolvedValue(MOCK_PATCHED_PARTY as never)

    const res = await authAgent(app)
      .patch('/api/parties/p-1')
      .send({ followUpAt: FUTURE_ISO, tags: ['vip'] })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.party.tags).toEqual(['vip'])
    expect(partyService.patchParty).toHaveBeenCalledWith(
      'biz-test-1',
      'p-1',
      expect.objectContaining({ followUpAt: FUTURE_ISO, tags: ['vip'] }),
    )
  })

  it('clears followUpAt with explicit null (200)', async () => {
    mockOwnerPermission()
    vi.mocked(partyService.patchParty).mockResolvedValue({
      ...MOCK_PATCHED_PARTY,
      followUpAt: null,
    } as never)

    const res = await authAgent(app)
      .patch('/api/parties/p-1')
      .send({ followUpAt: null })

    expect(res.status).toBe(200)
    expect(partyService.patchParty).toHaveBeenCalledWith(
      'biz-test-1',
      'p-1',
      expect.objectContaining({ followUpAt: null }),
    )
  })

  // Test 12.13 — M2 server-only field MUST be rejected by Pattern B .strict()
  it('12.13 — rejects lastContactedAt (M2 server-only field) with 400 VALIDATION_ERROR', async () => {
    mockOwnerPermission()

    const res = await authAgent(app)
      .patch('/api/parties/p-1')
      .send({
        lastContactedAt: new Date().toISOString(),
        tags: ['vip'],
      })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(partyService.patchParty).not.toHaveBeenCalled()
  })

  it('rejects loyaltyPointsCache (M2 server-only) with 400 VALIDATION_ERROR', async () => {
    mockOwnerPermission()
    const res = await authAgent(app)
      .patch('/api/parties/p-1')
      .send({ loyaltyPointsCache: 9999 })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(partyService.patchParty).not.toHaveBeenCalled()
  })

  it('rejects loyaltyOptOut (M2 server-only) with 400 VALIDATION_ERROR', async () => {
    mockOwnerPermission()
    const res = await authAgent(app)
      .patch('/api/parties/p-1')
      .send({ loyaltyOptOut: true })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(partyService.patchParty).not.toHaveBeenCalled()
  })

  it('returns 400 INVALID_FOLLOWUP_PAST when followUpAt is in the past', async () => {
    mockOwnerPermission()
    const res = await authAgent(app)
      .patch('/api/parties/p-1')
      .send({ followUpAt: PAST_ISO })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_FOLLOWUP_PAST')
    expect(partyService.patchParty).not.toHaveBeenCalled()
  })

  it('returns 401 without auth', async () => {
    const res = await anonAgent(app)
      .patch('/api/parties/p-1')
      .send({ followUpAt: FUTURE_ISO })
    expect(res.status).toBe(401)
  })

  it('returns 403 for staff without parties.edit', async () => {
    mockStaffPermission([])
    const res = await authAgent(app)
      .patch('/api/parties/p-1')
      .send({ followUpAt: FUTURE_ISO })
    expect(res.status).toBe(403)
  })
})

// ─── 12.4  GET /api/parties?tag= (single-tag narrow) ──────────────────────

describe('GET /api/parties?tag= (single-tag CRM narrow)', () => {
  it('forwards tag to service when ?tag=vip', async () => {
    mockOwnerPermission()
    vi.mocked(partyService.listParties).mockResolvedValue(MOCK_LIST_RESULT as never)

    const res = await authAgent(app).get('/api/parties?tag=vip')

    expect(res.status).toBe(200)
    expect(partyService.listParties).toHaveBeenCalledWith(
      'biz-test-1',
      expect.objectContaining({ tag: 'vip' }),
    )
  })
})
