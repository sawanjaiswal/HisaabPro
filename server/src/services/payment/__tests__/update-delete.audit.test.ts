/**
 * Payment update-delete — audit-write smoke (PR7 backfill).
 *
 * Asserts updatePayment and deletePayment each write ONE audit row inside
 * the same tx. Uses the global Proxy-mocked prisma.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { updatePayment, deletePayment } from '../update-delete.js'
import { prisma } from '../../../lib/prisma.js'

vi.mock('../selects.js', () => ({ PAYMENT_DETAIL_SELECT: {} }))
vi.mock('../../../lib/payment-types.js', () => ({
  paymentTypeDirection: vi.fn().mockReturnValue(1),
}))

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const BUSINESS_ID = 'biz-1'
const PAYMENT_ID = 'pay-1'
const USER_ID = 'user-actor'

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.payment.findFirst.mockResolvedValue({
    id: PAYMENT_ID,
    amount: 10000,
    partyId: 'party-1',
    type: 'PAYMENT_IN',
    allocations: [],
    discount: null,
  })
  mockPrisma.payment.update.mockResolvedValue({ id: PAYMENT_ID, deletedAt: new Date() })
  mockPrisma.payment.findUniqueOrThrow.mockResolvedValue({ id: PAYMENT_ID })
})

describe('updatePayment — audit', () => {
  it('writes one Payment UPDATE audit row with userId', async () => {
    await updatePayment(BUSINESS_ID, PAYMENT_ID, USER_ID, { notes: 'updated' })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'Payment',
        entityId: PAYMENT_ID,
        userId: USER_ID,
        action: 'UPDATE',
      }),
    })
  })
})

describe('deletePayment — audit', () => {
  it('writes one Payment DELETE audit row with userId', async () => {
    await deletePayment(BUSINESS_ID, PAYMENT_ID, USER_ID)

    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'Payment',
        entityId: PAYMENT_ID,
        userId: USER_ID,
        action: 'DELETE',
      }),
    })
  })
})
