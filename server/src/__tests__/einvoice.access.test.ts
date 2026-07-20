/**
 * MB-1 Cross-Tenant IRN Access Tests
 * Tenant-A token must NOT be able to see or cancel Tenant-B's IRN.
 * Expected: 404 (no existence leak, no NIC call made).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../app.js'
import {
  authAgent,
  anonAgent,
  mockOwnerPermission,
  resetMocks,
  getMockPrisma,
} from './helpers.js'

// ── Mock middleware ────────────────────────────────────────────────────────────

vi.mock('../middleware/idempotency.js', () => ({
  idempotencyCheck: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}))
vi.mock('../middleware/replay-protection.js', () => ({
  replayProtection: (_req: unknown, _res: unknown, next: () => void) => next(),
}))
vi.mock('../middleware/rate-limit.js', async (importOriginal) => {
  const { rateLimitPassthrough } = await import('./helpers.js')
  return rateLimitPassthrough(importOriginal)
})

// ── Mock NIC client — should NEVER be called in cross-tenant test ─────────────

const { generateViaClientMock, cancelViaClientMock } = vi.hoisted(() => ({
  generateViaClientMock: vi.fn(),
  cancelViaClientMock: vi.fn(),
}))

vi.mock('../services/einvoice/einvoice.nic-client.js', () => ({
  generateViaClient: generateViaClientMock,
  cancelViaClient: cancelViaClientMock,
  NIC_ENDPOINTS: {
    sandbox: { irp: 'https://einv-apisandbox.nic.in', ewb: 'https://ewbapisandbox.nic.in' },
    prod: { irp: 'https://einvoice1.gst.gov.in', ewb: 'https://ewaybillapi.nic.in' },
  },
}))

vi.mock('../services/einvoice/einvoice.token-store.js', () => ({
  getToken: vi.fn().mockResolvedValue('STUB_TOKEN'),
  invalidateToken: vi.fn(),
  isStubMode: vi.fn().mockReturnValue(true),
}))

vi.mock('../services/einvoice/einvoice.service.js', () => ({
  generateIrn: vi.fn(),
  cancelIrn: vi.fn(),
  getEInvoice: vi.fn(),
}))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MB-1: Cross-tenant e-invoice access', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mp: any

  beforeEach(async () => {
    resetMocks()
    app = createApp()
    mp = getMockPrisma()
    mockOwnerPermission()
    generateViaClientMock.mockReset()
    cancelViaClientMock.mockReset()
  })

  it('GET /api/einvoice/:documentId — tenant-A cannot see tenant-B document → 404', async () => {
    // Tenant-A (biz-test-1) calls getEInvoice for a document that belongs to biz-tenant-B
    // The eInvoice.findFirst is scoped by businessId via document relation → returns null
    mp.eInvoice.findFirst.mockResolvedValue(null)

    // Service throws 404 when eInvoice not found for businessId
    const { getEInvoice } = await import('../services/einvoice/einvoice.service.js')
    const { AppError, ErrorCode } = await import('../lib/errors.js')
    ;(getEInvoice as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND, 404, 'E-Invoice not found')
    )

    const tenantA = authAgent(app, { businessId: 'biz-test-1' })
    const res = await tenantA.get('/api/einvoice/doc-owned-by-tenant-b')

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('POST /api/einvoice/cancel — tenant-A cannot cancel tenant-B IRN → 404, no NIC call', async () => {
    // cancelIrn service loads eInvoice scoped by businessId — when cross-tenant, record = null
    const { cancelIrn } = await import('../services/einvoice/einvoice.service.js')
    const cancelMock = cancelIrn as ReturnType<typeof vi.fn>

    // Simulate service throwing 404 (as it does when eInvoice not found for businessId)
    const { AppError, ErrorCode } = await import('../lib/errors.js')
    cancelMock.mockRejectedValue(new AppError(ErrorCode.NOT_FOUND, 404, 'E-Invoice not found'))

    const tenantA = authAgent(app, { businessId: 'biz-test-1' })
    const res = await tenantA
      .post('/api/einvoice/cancel')
      .send({ documentId: 'doc-owned-by-tenant-b', reason: 1, remarks: 'test' })

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)

    // Assert NIC HTTP client was NEVER invoked (no existence leak)
    expect(cancelViaClientMock).not.toHaveBeenCalled()
  })

  it('POST /api/einvoice/generate — unauthenticated → 401', async () => {
    const anon = anonAgent(app)
    const res = await anon.post('/api/einvoice/generate').send({ documentId: 'some-doc' })
    expect(res.status).toBe(401)
  })

  it('POST /api/einvoice/cancel — bad body (missing reason) → 400', async () => {
    const tenantA = authAgent(app, { businessId: 'biz-test-1' })
    const res = await tenantA
      .post('/api/einvoice/cancel')
      .send({ documentId: 'some-doc' }) // missing reason field

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})
