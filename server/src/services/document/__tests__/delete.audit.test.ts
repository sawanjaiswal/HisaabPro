/**
 * Document delete — audit-write smoke (PR7 backfill).
 *
 * Asserts deleteDocument writes ONE Document DELETE audit row inside the
 * same tx as the soft-delete update.
 *
 * Uses the global Proxy-mocked prisma (src/__tests__/setup.ts).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { deleteDocument } from '../delete.js'
import { prisma } from '../../../lib/prisma.js'

vi.mock('../../stock.service.js', () => ({
  reverseForInvoice: vi.fn().mockResolvedValue(undefined),
  scheduleAlertChecks: vi.fn(),
}))
vi.mock('../helpers.js', () => ({
  STOCK_DECREASE_TYPES: new Set(['SALE_INVOICE']),
  STOCK_INCREASE_TYPES: new Set(['PURCHASE_INVOICE']),
  AFFECTS_OUTSTANDING: new Set(['SALE_INVOICE']),
  updateOutstanding: vi.fn(),
  getOutstandingReverseDelta: vi.fn().mockReturnValue(0),
}))

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
    documentNumber: 'INV-001',
    lineItems: [],
  })
  mockPrisma.documentSettings.findUnique.mockResolvedValue({ recycleBinRetentionDays: 30 })
  mockPrisma.document.update.mockResolvedValue({
    id: DOCUMENT_ID,
    status: 'DELETED',
    deletedAt: new Date(),
    permanentDeleteAt: new Date(),
  })
})

describe('deleteDocument — audit', () => {
  it('writes one Document DELETE audit row with userId + entityLabel', async () => {
    await deleteDocument(BUSINESS_ID, DOCUMENT_ID, USER_ID)

    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'Document',
        entityId: DOCUMENT_ID,
        entityLabel: 'INV-001',
        userId: USER_ID,
        action: 'DELETE',
      }),
    })
  })
})
