/**
 * Document Routes — Integration Tests
 * Tests route-layer wiring: auth, permissions, validation, handler → service calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../app.js'
import {
  authAgent,
  anonAgent,
  mockOwnerPermission,
  mockStaffPermission,
  resetMocks,
  TEST_USER,
} from './helpers.js'

// ── Mock middleware that depend on external state ────────────────────────────
vi.mock('../middleware/idempotency.js', () => ({
  idempotencyCheck: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}))
vi.mock('../middleware/replay-protection.js', () => ({
  replayProtection: (_req: unknown, _res: unknown, next: () => void) => next(),
}))
vi.mock('../middleware/rate-limit.js', () => {
  const passthrough = (_req: unknown, _res: unknown, next: () => void) => next()
  return {
    createRateLimiter: () => passthrough,
    apiRateLimiter: passthrough,
    authRateLimiter: passthrough,
    otpRateLimiter: passthrough,
    sensitiveMutationLimiter: passthrough,
    couponValidateRateLimiter: passthrough,
    couponIpRateLimiter: passthrough,
  }
})

// ── Mock service layer (we test route wiring, not business logic) ───────────
vi.mock('../services/document.service.js', () => ({
  createDocument: vi.fn(),
  listDocuments: vi.fn(),
  getDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  convertDocument: vi.fn(),
  restoreDocument: vi.fn(),
  permanentDeleteDocument: vi.fn(),
  listRecycleBin: vi.fn(),
  emptyRecycleBin: vi.fn(),
}))
vi.mock('../services/stock.service.js', () => ({
  validateStockForInvoice: vi.fn(),
  deductForSaleInvoice: vi.fn(),
  addForPurchaseInvoice: vi.fn(),
  reverseForInvoice: vi.fn(),
  scheduleAlertChecks: vi.fn(),
}))
vi.mock('../services/notification.service.js', () => ({
  sendWhatsApp: vi.fn(),
  sendEmail: vi.fn(),
}))
vi.mock('../lib/email-templates.js', () => ({
  renderInvoiceShareEmail: vi.fn().mockReturnValue('<html></html>'),
}))
vi.mock('../services/pdf.service.js', () => ({
  generateInvoicePdf: vi.fn().mockResolvedValue(null),
}))

import * as documentService from '../services/document.service.js'
import { validateStockForInvoice } from '../services/stock.service.js'

const app = createApp()

// ── Mock data ───────────────────────────────────────────────────────────────

const MOCK_DOCUMENT = {
  id: 'doc-1',
  type: 'SALE_INVOICE',
  status: 'SAVED',
  documentNumber: 'SI-0001',
  documentDate: '2026-03-27',
  partyId: 'p-1',
  grandTotal: 50000,
  balanceDue: 50000,
  subtotal: 50000,
  totalDiscount: 0,
  totalAdditionalCharges: 0,
  roundOff: 0,
  totalProfit: 10000,
  paidAmount: 0,
  createdAt: '2026-03-27T00:00:00.000Z',
  updatedAt: '2026-03-27T00:00:00.000Z',
  businessId: TEST_USER.businessId,
  party: { id: 'p-1', name: 'Test Party', phone: '9876500000' },
  lineItems: [
    {
      id: 'li-1',
      productId: 'prod-1',
      quantity: 2,
      rate: 25000,
      discountType: 'AMOUNT',
      discountValue: 0,
      discountAmount: 0,
      lineTotal: 50000,
      sortOrder: 0,
    },
  ],
}

const MOCK_LIST_RESULT = {
  documents: [MOCK_DOCUMENT],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  summary: { totalAmount: 50000, totalPaid: 0, totalDue: 50000 },
}

const CREATE_BODY = {
  type: 'SALE_INVOICE',
  status: 'SAVED',
  partyId: 'p-1',
  documentDate: '2026-03-27',
  lineItems: [
    { productId: 'prod-1', quantity: 2, rate: 25000, discountType: 'AMOUNT', discountValue: 0 },
  ],
  additionalCharges: [],
  includeSignature: false,
}

const UPDATE_BODY = {
  status: 'SAVED',
  notes: 'Updated notes',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetMocks()
  vi.mocked(documentService.listDocuments).mockReset()
  vi.mocked(documentService.getDocument).mockReset()
  vi.mocked(documentService.createDocument).mockReset()
  vi.mocked(documentService.updateDocument).mockReset()
  vi.mocked(documentService.deleteDocument).mockReset()
  vi.mocked(documentService.convertDocument).mockReset()
  vi.mocked(documentService.restoreDocument).mockReset()
  vi.mocked(documentService.permanentDeleteDocument).mockReset()
  vi.mocked(documentService.listRecycleBin).mockReset()
  vi.mocked(documentService.emptyRecycleBin).mockReset()
  vi.mocked(validateStockForInvoice).mockReset()
})

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('Document Routes — /api/documents', () => {
  // ── 1. GET /documents — success (list) ──────────────────────────────────
  it('GET / returns paginated document list', async () => {
    mockOwnerPermission()
    vi.mocked(documentService.listDocuments).mockResolvedValue(MOCK_LIST_RESULT)

    const res = await authAgent(app)
      .get('/api/documents?type=SALE_INVOICE')
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.data.documents).toHaveLength(1)
    expect(res.body.data.pagination.total).toBe(1)
    expect(documentService.listDocuments).toHaveBeenCalledWith(
      TEST_USER.businessId,
      expect.objectContaining({ type: 'SALE_INVOICE' })
    )
  })

  // ── 2. GET /documents — 401 no auth ─────────────────────────────────────
  it('GET / returns 401 without auth', async () => {
    const res = await anonAgent(app)
      .get('/api/documents?type=SALE_INVOICE')
      .expect(401)

    expect(res.body.success).toBe(false)
  })

  // ── 3. GET /documents/:id — success ─────────────────────────────────────
  it('GET /:id returns document detail', async () => {
    mockOwnerPermission()
    vi.mocked(documentService.getDocument).mockResolvedValue(MOCK_DOCUMENT)

    const res = await authAgent(app)
      .get('/api/documents/doc-1')
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBe('doc-1')
    expect(documentService.getDocument).toHaveBeenCalledWith(TEST_USER.businessId, 'doc-1')
  })

  // ── 4. POST /documents — success (201, owner) ──────────────────────────
  it('POST / creates document with 201 (owner)', async () => {
    mockOwnerPermission()
    vi.mocked(documentService.createDocument).mockResolvedValue(MOCK_DOCUMENT)

    const res = await authAgent(app)
      .post('/api/documents')
      .send(CREATE_BODY)
      .expect(201)

    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBe('doc-1')
    expect(documentService.createDocument).toHaveBeenCalledWith(
      TEST_USER.businessId,
      TEST_USER.userId,
      expect.objectContaining({ type: 'SALE_INVOICE', partyId: 'p-1' })
    )
  })

  // ── 5. POST /documents — 403 no invoicing.create permission ─────────────
  it('POST / returns 403 without invoicing.create permission', async () => {
    mockStaffPermission(['invoicing.view', 'payments.record'])

    const res = await authAgent(app)
      .post('/api/documents')
      .send(CREATE_BODY)
      .expect(403)

    expect(res.body.success).toBe(false)
    expect(documentService.createDocument).not.toHaveBeenCalled()
  })

  // ── 6. POST /documents — 400 validation (missing required fields) ──────
  it('POST / returns 400 when body missing required fields', async () => {
    mockOwnerPermission()

    const res = await authAgent(app)
      .post('/api/documents')
      .send({ status: 'DRAFT' }) // missing type, partyId, documentDate, lineItems
      .expect(400)

    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(documentService.createDocument).not.toHaveBeenCalled()
  })

  // ── 7. PUT /documents/:id — success ─────────────────────────────────────
  it('PUT /:id updates document', async () => {
    mockOwnerPermission()
    vi.mocked(documentService.updateDocument).mockResolvedValue({
      ...MOCK_DOCUMENT,
      notes: 'Updated notes',
    })

    const res = await authAgent(app)
      .put('/api/documents/doc-1')
      .send(UPDATE_BODY)
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(documentService.updateDocument).toHaveBeenCalledWith(
      TEST_USER.businessId,
      'doc-1',
      TEST_USER.userId,
      expect.objectContaining({ status: 'SAVED', notes: 'Updated notes' })
    )
  })

  // ── 8. DELETE /documents/:id — success (soft delete) ────────────────────
  it('DELETE /:id soft-deletes document', async () => {
    mockOwnerPermission()
    vi.mocked(documentService.deleteDocument).mockResolvedValue({
      id: 'doc-1',
      status: 'DELETED',
      deletedAt: new Date().toISOString(),
      permanentDeleteAt: new Date().toISOString(),
    })

    const res = await authAgent(app)
      .delete('/api/documents/doc-1')
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('DELETED')
    expect(documentService.deleteDocument).toHaveBeenCalledWith(
      TEST_USER.businessId,
      'doc-1',
      TEST_USER.userId
    )
  })

  // ── 9. POST /documents/quick-sale — success (201) ──────────────────────
  it('POST /quick-sale creates invoice + payment with 201', async () => {
    mockOwnerPermission()
    const { prisma } = await import('../lib/prisma.js')
    const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

    // Mock party lookup (walk-in upsert)
    mockPrisma.party.upsert = vi.fn().mockResolvedValue({ id: 'walkin-1' })
    // Mock product lookup
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 'prod-1', salePrice: 25000, name: 'Widget' },
    ])
    // Mock document creation via service
    vi.mocked(documentService.createDocument).mockResolvedValue({
      id: 'inv-qs-1',
      grandTotal: 50000,
      balanceDue: 50000,
    })
    // Mock payment creation via $transaction (already passes through in setup)
    mockPrisma.payment.create = vi.fn().mockResolvedValue({
      id: 'pmt-1',
      amount: 50000,
      mode: 'cash',
      date: new Date(),
    })
    mockPrisma.paymentAllocation.create = vi.fn().mockResolvedValue({})
    mockPrisma.document.update = vi.fn().mockResolvedValue({})

    const res = await authAgent(app)
      .post('/api/documents/quick-sale')
      .send({
        items: [{ productId: 'prod-1', quantity: 2 }],
        paymentMode: 'cash',
        amountPaid: 50000,
      })
      .expect(201)

    expect(res.body.success).toBe(true)
    expect(res.body.data.invoice.id).toBe('inv-qs-1')
    expect(res.body.data.payment.id).toBe('pmt-1')
    expect(res.body.data.payment.changeAmount).toBe(0)
  })

  // ── 10. POST /documents/:id/restore — success ──────────────────────────
  it('POST /:id/restore restores from recycle bin', async () => {
    mockOwnerPermission()
    vi.mocked(documentService.restoreDocument).mockResolvedValue({
      ...MOCK_DOCUMENT,
      status: 'SAVED',
      deletedAt: null,
    })

    const res = await authAgent(app)
      .post('/api/documents/doc-1/restore')
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('SAVED')
    expect(documentService.restoreDocument).toHaveBeenCalledWith(
      TEST_USER.businessId,
      'doc-1',
      TEST_USER.userId
    )
  })

  // ── 11. GET /documents/recycle-bin — success ────────────────────────────
  it('GET /recycle-bin returns deleted documents', async () => {
    mockOwnerPermission()
    const recycleBinResult = {
      documents: [{ ...MOCK_DOCUMENT, status: 'DELETED', deletedAt: '2026-03-27T00:00:00.000Z' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }
    vi.mocked(documentService.listRecycleBin).mockResolvedValue(recycleBinResult)

    const res = await authAgent(app)
      .get('/api/documents/recycle-bin')
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.data.documents).toHaveLength(1)
    expect(documentService.listRecycleBin).toHaveBeenCalledWith(
      TEST_USER.businessId,
      expect.objectContaining({ page: 1 })
    )
  })

  // ── 12. DELETE /documents/recycle-bin — success (empty bin) ─────────────
  it('DELETE /recycle-bin empties the entire bin', async () => {
    mockOwnerPermission()
    vi.mocked(documentService.emptyRecycleBin).mockResolvedValue({ deletedCount: 3 })

    const res = await authAgent(app)
      .delete('/api/documents/recycle-bin')
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.data.deletedCount).toBe(3)
    expect(documentService.emptyRecycleBin).toHaveBeenCalledWith(TEST_USER.businessId)
  })
})
