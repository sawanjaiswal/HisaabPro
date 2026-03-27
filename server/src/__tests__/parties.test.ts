/**
 * Party Routes — Integration Tests
 * Tests auth, permission, validation, and service delegation for all party endpoints.
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

// Mock rate-limit middleware — passthrough for tests
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
  }
})

// Mock the party service — all business logic is tested separately
vi.mock('../services/party.service.js', () => ({
  createParty: vi.fn(),
  listParties: vi.fn(),
  getParty: vi.fn(),
  updateParty: vi.fn(),
  deleteParty: vi.fn(),
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
  setPricing: vi.fn(),
  getPartyPricing: vi.fn(),
}))

import * as partyService from '../services/party.service.js'

const app = createApp()

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_PARTY = {
  id: 'p-1',
  businessId: 'biz-test-1',
  name: 'Test Customer',
  phone: '9876543210',
  type: 'CUSTOMER',
  email: null,
  companyName: null,
  groupId: null,
  tags: [],
  gstin: null,
  pan: null,
  creditLimit: 0,
  creditLimitMode: 'WARN',
  outstandingBalance: 0,
  totalBusiness: 0,
  notes: null,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const CREATE_PARTY_BODY = {
  name: 'Test Customer',
  phone: '9876543210',
  type: 'CUSTOMER',
}

const MOCK_ADDRESS = {
  id: 'addr-1',
  partyId: 'p-1',
  label: 'Default',
  line1: '123 Main St',
  line2: null,
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  type: 'BILLING',
  isDefault: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const CREATE_ADDRESS_BODY = {
  line1: '123 Main St',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  type: 'BILLING',
  isDefault: true,
}

const MOCK_LIST_RESULT = {
  parties: [MOCK_PARTY],
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

const MOCK_PRICING = [
  { id: 'pr-1', productId: 'prod-1', price: 10000, minQty: 1, updatedAt: new Date().toISOString() },
]

const MOCK_PRICING_LIST = {
  pricing: MOCK_PRICING,
  pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetMocks()
  vi.mocked(partyService.createParty).mockReset()
  vi.mocked(partyService.listParties).mockReset()
  vi.mocked(partyService.getParty).mockReset()
  vi.mocked(partyService.updateParty).mockReset()
  vi.mocked(partyService.deleteParty).mockReset()
  vi.mocked(partyService.createAddress).mockReset()
  vi.mocked(partyService.updateAddress).mockReset()
  vi.mocked(partyService.deleteAddress).mockReset()
  vi.mocked(partyService.setPricing).mockReset()
  vi.mocked(partyService.getPartyPricing).mockReset()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/parties', () => {
  it('creates a party successfully (201, owner)', async () => {
    mockOwnerPermission()
    vi.mocked(partyService.createParty).mockResolvedValue(MOCK_PARTY)

    const res = await authAgent(app).post('/api/parties').send(CREATE_PARTY_BODY)

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.party).toEqual(MOCK_PARTY)
    expect(partyService.createParty).toHaveBeenCalledWith('biz-test-1', expect.objectContaining({
      name: 'Test Customer',
      phone: '9876543210',
      type: 'CUSTOMER',
    }))
  })

  it('returns 401 without auth token', async () => {
    const res = await anonAgent(app).post('/api/parties').send(CREATE_PARTY_BODY)

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(partyService.createParty).not.toHaveBeenCalled()
  })

  it('returns 403 for staff without parties.create permission', async () => {
    mockStaffPermission([])

    const res = await authAgent(app).post('/api/parties').send(CREATE_PARTY_BODY)

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
    expect(partyService.createParty).not.toHaveBeenCalled()
  })

  it('returns 400 validation error when name is missing', async () => {
    mockOwnerPermission()

    const res = await authAgent(app).post('/api/parties').send({ type: 'CUSTOMER' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(partyService.createParty).not.toHaveBeenCalled()
  })
})

describe('GET /api/parties', () => {
  it('lists parties with pagination', async () => {
    mockOwnerPermission()
    vi.mocked(partyService.listParties).mockResolvedValue(MOCK_LIST_RESULT)

    const res = await authAgent(app).get('/api/parties')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.parties).toHaveLength(1)
    expect(res.body.data.pagination.total).toBe(1)
    expect(partyService.listParties).toHaveBeenCalledWith(
      'biz-test-1',
      expect.objectContaining({ page: 1, limit: 50 })
    )
  })
})

describe('GET /api/parties/:id', () => {
  it('returns party detail', async () => {
    mockOwnerPermission()
    vi.mocked(partyService.getParty).mockResolvedValue(MOCK_PARTY)

    const res = await authAgent(app).get('/api/parties/p-1')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.party.id).toBe('p-1')
    expect(partyService.getParty).toHaveBeenCalledWith('biz-test-1', 'p-1')
  })
})

describe('PUT /api/parties/:id', () => {
  it('updates a party successfully', async () => {
    mockOwnerPermission()
    const updated = { ...MOCK_PARTY, name: 'Updated Name' }
    vi.mocked(partyService.updateParty).mockResolvedValue(updated)

    const res = await authAgent(app).put('/api/parties/p-1').send({ name: 'Updated Name' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.party.name).toBe('Updated Name')
    expect(partyService.updateParty).toHaveBeenCalledWith('biz-test-1', 'p-1', { name: 'Updated Name' })
  })
})

describe('DELETE /api/parties/:id', () => {
  it('soft-deletes a party', async () => {
    mockOwnerPermission()
    vi.mocked(partyService.deleteParty).mockResolvedValue({ deleted: true, mode: 'soft' })

    const res = await authAgent(app).delete('/api/parties/p-1')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.deleted).toBe(true)
    expect(res.body.data.mode).toBe('soft')
    expect(partyService.deleteParty).toHaveBeenCalledWith('biz-test-1', 'p-1', false)
  })
})

describe('POST /api/parties/:partyId/addresses', () => {
  it('creates an address (201)', async () => {
    mockOwnerPermission()
    vi.mocked(partyService.createAddress).mockResolvedValue(MOCK_ADDRESS)

    const res = await authAgent(app)
      .post('/api/parties/p-1/addresses')
      .send(CREATE_ADDRESS_BODY)

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.address.id).toBe('addr-1')
    expect(partyService.createAddress).toHaveBeenCalledWith(
      'biz-test-1',
      'p-1',
      expect.objectContaining({ line1: '123 Main St', city: 'Mumbai' })
    )
  })
})

describe('DELETE /api/parties/:partyId/addresses/:addressId', () => {
  it('deletes an address', async () => {
    mockOwnerPermission()
    vi.mocked(partyService.deleteAddress).mockResolvedValue({ deleted: true })

    const res = await authAgent(app).delete('/api/parties/p-1/addresses/addr-1')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.deleted).toBe(true)
    expect(partyService.deleteAddress).toHaveBeenCalledWith('biz-test-1', 'p-1', 'addr-1')
  })
})

describe('PUT /api/parties/:partyId/pricing', () => {
  it('sets pricing overrides', async () => {
    mockOwnerPermission()
    vi.mocked(partyService.setPricing).mockResolvedValue(MOCK_PRICING)

    const body = {
      pricing: [{ productId: 'prod-1', price: 10000, minQty: 1 }],
    }
    const res = await authAgent(app).put('/api/parties/p-1/pricing').send(body)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.pricing).toEqual(MOCK_PRICING)
    expect(partyService.setPricing).toHaveBeenCalledWith(
      'biz-test-1',
      'p-1',
      expect.objectContaining({ pricing: body.pricing })
    )
  })
})

describe('GET /api/parties/:partyId/pricing', () => {
  it('lists pricing overrides', async () => {
    mockOwnerPermission()
    vi.mocked(partyService.getPartyPricing).mockResolvedValue(MOCK_PRICING_LIST)

    const res = await authAgent(app).get('/api/parties/p-1/pricing')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.pricing).toHaveLength(1)
    expect(res.body.data.pagination.total).toBe(1)
    expect(partyService.getPartyPricing).toHaveBeenCalledWith(
      'biz-test-1',
      'p-1',
      undefined,
      1,
      50
    )
  })
})
