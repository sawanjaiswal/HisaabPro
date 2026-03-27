/**
 * Payment Routes — Integration Tests
 * Tests auth, permission, validation, and service delegation for all payment endpoints.
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

// ─── Middleware Mocks (passthrough) ─────────────────────────────────────────

vi.mock('../middleware/idempotency.js', () => ({
  idempotencyCheck: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}))

vi.mock('../middleware/replay-protection.js', () => ({
  replayProtection: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

// ─── Service Mock ───────────────────────────────────────────────────────────

vi.mock('../services/payment.service.js', () => ({
  listPayments: vi.fn(),
  getPayment: vi.fn(),
  createPayment: vi.fn(),
  updatePayment: vi.fn(),
  deletePayment: vi.fn(),
  restorePayment: vi.fn(),
  updateAllocations: vi.fn(),
  listOutstanding: vi.fn(),
  getPartyOutstanding: vi.fn(),
  sendReminder: vi.fn(),
  sendBulkReminders: vi.fn(),
  listReminders: vi.fn(),
  getReminderConfig: vi.fn(),
  updateReminderConfig: vi.fn(),
}))

import * as paymentService from '../services/payment.service.js'

// ─── App + Mock Data ────────────────────────────────────────────────────────

const app = createApp()

const MOCK_PAYMENT = {
  id: 'pay-1',
  type: 'PAYMENT_IN',
  partyId: 'p-1',
  amount: 50000,
  date: '2026-03-27',
  mode: 'CASH',
  businessId: 'biz-test-1',
  referenceNumber: null,
  notes: null,
  createdAt: '2026-03-27T10:00:00.000Z',
  updatedAt: '2026-03-27T10:00:00.000Z',
}

const MOCK_LIST_RESULT = {
  payments: [MOCK_PAYMENT],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  summary: { totalIn: 50000, totalOut: 0, net: 50000 },
}

const MOCK_OUTSTANDING_LIST = {
  parties: [
    {
      partyId: 'p-1',
      partyName: 'Test Party',
      partyPhone: '9876543210',
      partyType: 'CUSTOMER',
      outstanding: 50000,
      type: 'RECEIVABLE',
      invoiceCount: 2,
      lastPaymentDate: '2026-03-27T10:00:00.000Z',
    },
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  totals: { totalReceivable: 50000, totalPayable: 0, net: 50000 },
}

const MOCK_PARTY_OUTSTANDING = {
  partyId: 'p-1',
  partyName: 'Test Party',
  outstanding: 50000,
  invoices: [],
  pagination: { hasMore: false, nextCursor: undefined },
}

const CREATE_BODY = {
  type: 'PAYMENT_IN',
  partyId: 'p-1',
  amount: 50000,
  date: '2026-03-27',
  mode: 'CASH',
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetMocks()
  vi.mocked(paymentService.listPayments).mockReset()
  vi.mocked(paymentService.getPayment).mockReset()
  vi.mocked(paymentService.createPayment).mockReset()
  vi.mocked(paymentService.updatePayment).mockReset()
  vi.mocked(paymentService.deletePayment).mockReset()
  vi.mocked(paymentService.restorePayment).mockReset()
  vi.mocked(paymentService.updateAllocations).mockReset()
  vi.mocked(paymentService.listOutstanding).mockReset()
  vi.mocked(paymentService.getPartyOutstanding).mockReset()
})

// ─── LIST ───────────────────────────────────────────────────────────────────

describe('GET /api/payments', () => {
  it('returns paginated payment list for authenticated user', async () => {
    mockOwnerPermission()
    vi.mocked(paymentService.listPayments).mockResolvedValue(MOCK_LIST_RESULT)

    const res = await authAgent(app).get('/api/payments')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.payments).toHaveLength(1)
    expect(res.body.data.pagination.total).toBe(1)
    expect(paymentService.listPayments).toHaveBeenCalledOnce()
  })

  it('returns 401 without auth token', async () => {
    const res = await anonAgent(app).get('/api/payments')

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })
})

// ─── GET BY ID ──────────────────────────────────────────────────────────────

describe('GET /api/payments/:id', () => {
  it('returns payment detail for authenticated user', async () => {
    mockOwnerPermission()
    vi.mocked(paymentService.getPayment).mockResolvedValue(MOCK_PAYMENT as never)

    const res = await authAgent(app).get('/api/payments/pay-1')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBe('pay-1')
    expect(paymentService.getPayment).toHaveBeenCalledWith('biz-test-1', 'pay-1')
  })
})

// ─── CREATE ─────────────────────────────────────────────────────────────────

describe('POST /api/payments', () => {
  it('creates payment with 201 for owner', async () => {
    mockOwnerPermission()
    vi.mocked(paymentService.createPayment).mockResolvedValue(MOCK_PAYMENT as never)

    const res = await authAgent(app)
      .post('/api/payments')
      .send(CREATE_BODY)

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBe('pay-1')
    expect(paymentService.createPayment).toHaveBeenCalledOnce()
  })

  it('returns 403 for staff without payments.record permission', async () => {
    mockStaffPermission(['invoicing.view'])

    const res = await authAgent(app)
      .post('/api/payments')
      .send(CREATE_BODY)

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
    expect(paymentService.createPayment).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid body (missing required fields)', async () => {
    mockOwnerPermission()

    const res = await authAgent(app)
      .post('/api/payments')
      .send({ partyId: 'p-1' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(paymentService.createPayment).not.toHaveBeenCalled()
  })
})

// ─── UPDATE ─────────────────────────────────────────────────────────────────

describe('PUT /api/payments/:id', () => {
  it('updates payment for owner', async () => {
    mockOwnerPermission()
    const updated = { ...MOCK_PAYMENT, amount: 60000 }
    vi.mocked(paymentService.updatePayment).mockResolvedValue(updated as never)

    const res = await authAgent(app)
      .put('/api/payments/pay-1')
      .send({ amount: 60000 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.amount).toBe(60000)
    expect(paymentService.updatePayment).toHaveBeenCalledWith(
      'biz-test-1',
      'pay-1',
      'user-test-1',
      { amount: 60000 }
    )
  })
})

// ─── DELETE ──────────────────────────────────────────────────────────────────

describe('DELETE /api/payments/:id', () => {
  it('soft-deletes payment for owner', async () => {
    mockOwnerPermission()
    const deleteResult = { id: 'pay-1', deletedAt: '2026-03-27T12:00:00.000Z' }
    vi.mocked(paymentService.deletePayment).mockResolvedValue(deleteResult as never)

    const res = await authAgent(app).delete('/api/payments/pay-1')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBe('pay-1')
    expect(paymentService.deletePayment).toHaveBeenCalledWith(
      'biz-test-1',
      'pay-1',
      'user-test-1'
    )
  })
})

// ─── RESTORE ────────────────────────────────────────────────────────────────

describe('POST /api/payments/:id/restore', () => {
  it('restores deleted payment for owner', async () => {
    mockOwnerPermission()
    vi.mocked(paymentService.restorePayment).mockResolvedValue(MOCK_PAYMENT as never)

    const res = await authAgent(app).post('/api/payments/pay-1/restore')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBe('pay-1')
    expect(paymentService.restorePayment).toHaveBeenCalledWith(
      'biz-test-1',
      'pay-1',
      'user-test-1'
    )
  })
})

// ─── ALLOCATIONS ────────────────────────────────────────────────────────────

describe('PUT /api/payments/:id/allocations', () => {
  it('updates allocations for owner', async () => {
    mockOwnerPermission()
    vi.mocked(paymentService.updateAllocations).mockResolvedValue(MOCK_PAYMENT as never)

    const res = await authAgent(app)
      .put('/api/payments/pay-1/allocations')
      .send({ allocations: [{ invoiceId: 'inv-1', amount: 30000 }] })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(paymentService.updateAllocations).toHaveBeenCalledWith(
      'biz-test-1',
      'pay-1',
      { allocations: [{ invoiceId: 'inv-1', amount: 30000 }] }
    )
  })
})

// ─── OUTSTANDING ────────────────────────────────────────────────────────────

describe('GET /api/payments/outstanding/list', () => {
  it('returns outstanding balances list', async () => {
    mockOwnerPermission()
    vi.mocked(paymentService.listOutstanding).mockResolvedValue(MOCK_OUTSTANDING_LIST)

    const res = await authAgent(app).get('/api/payments/outstanding/list')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.parties).toHaveLength(1)
    expect(res.body.data.totals.totalReceivable).toBe(50000)
    expect(paymentService.listOutstanding).toHaveBeenCalledOnce()
  })
})

describe('GET /api/payments/outstanding/:partyId', () => {
  it('returns party outstanding detail', async () => {
    mockOwnerPermission()
    vi.mocked(paymentService.getPartyOutstanding).mockResolvedValue(MOCK_PARTY_OUTSTANDING as never)

    const res = await authAgent(app).get('/api/payments/outstanding/p-1')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.partyId).toBe('p-1')
    expect(res.body.data.outstanding).toBe(50000)
    expect(paymentService.getPartyOutstanding).toHaveBeenCalledWith(
      'biz-test-1',
      'p-1',
      undefined,
      20
    )
  })
})
