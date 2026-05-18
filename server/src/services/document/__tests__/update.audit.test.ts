/**
 * Document update — audit-write smoke (PR7 backfill).
 *
 * Asserts updateDocument writes ONE Document UPDATE audit row inside the
 * same tx as the document.update. Uses the global Proxy-mocked prisma.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { updateDocument } from '../update.js'
import { prisma } from '../../../lib/prisma.js'

vi.mock('../../stock.service.js', () => ({
  deductForSaleInvoice: vi.fn(),
  addForPurchaseInvoice: vi.fn(),
  reverseForInvoice: vi.fn(),
  scheduleAlertChecks: vi.fn(),
}))
vi.mock('../../document-number.service.js', () => ({
  generateNextNumber: vi.fn().mockResolvedValue({ documentNumber: 'INV-001', sequenceNumber: 1, financialYear: '2526' }),
}))
vi.mock('../helpers.js', () => ({
  STOCK_DECREASE_TYPES: new Set(['SALE_INVOICE']),
  STOCK_INCREASE_TYPES: new Set(['PURCHASE_INVOICE']),
  AFFECTS_OUTSTANDING: new Set(['SALE_INVOICE']),
  updateOutstanding: vi.fn(),
  getOutstandingDelta: vi.fn().mockReturnValue(0),
  getOutstandingReverseDelta: vi.fn().mockReturnValue(0),
}))
vi.mock('../custom-fields.js', () => ({ persistDocumentCustomFieldValues: vi.fn() }))
vi.mock('../update-recompute.js', () => ({
  recomputeLineItemsAndTotals: vi.fn().mockResolvedValue({ totals: null, moqWarnings: [] }),
}))
vi.mock('../document-commission.js', () => ({
  accrueForSaleInvoice: vi.fn().mockResolvedValue(null),
  emitDocumentCommissionAnalytics: vi.fn(),
}))
vi.mock('../selects.js', () => ({ DOCUMENT_DETAIL_SELECT: {} }))

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const BUSINESS_ID = 'biz-1'
const DOCUMENT_ID = 'doc-1'
const USER_ID = 'user-actor'

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.document.findFirst.mockResolvedValue({
    id: DOCUMENT_ID,
    type: 'SALE_INVOICE',
    status: 'DRAFT',
    partyId: 'party-1',
    grandTotal: 0,
    placeOfSupply: null,
    isComposite: false,
    lineItems: [],
  })
  mockPrisma.document.update.mockResolvedValue({ id: DOCUMENT_ID })
  mockPrisma.document.findFirstOrThrow.mockResolvedValue({ id: DOCUMENT_ID })
})

describe('updateDocument — audit', () => {
  it('writes one Document UPDATE audit row with userId', async () => {
    await updateDocument(BUSINESS_ID, DOCUMENT_ID, USER_ID, { notes: 'updated' })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'Document',
        entityId: DOCUMENT_ID,
        userId: USER_ID,
        action: 'UPDATE',
      }),
    })
  })
})
