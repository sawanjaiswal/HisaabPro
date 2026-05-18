/**
 * Loyalty program — audit-write smoke (PR7 backfill).
 *
 * Asserts upsertProgram writes ONE LoyaltyProgram audit row inside its
 * tx (action CREATE on first save, UPDATE on subsequent saves).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { upsertProgram } from '../loyalty-program.service.js'
import { prisma } from '../../../lib/prisma.js'

vi.mock('../../../lib/analytics.js', () => ({ analyticsEmit: vi.fn() }))

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const BUSINESS_ID = 'biz-1'
const USER_ID = 'user-actor'

const INPUT = {
  enabled: true,
  accrualRateBps: 100,
  accrualMinSpendPaise: 0,
  redemptionUnit: 100,
  redemptionPaisePerUnit: 100,
  expiryMonths: 12,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.loyaltyProgram.upsert.mockResolvedValue({
    id: 'prog-1',
    businessId: BUSINESS_ID,
    enabled: true,
    accrualRateBps: 100,
    accrualMinSpendPaise: 0,
    redemptionUnit: 100,
    redemptionPaisePerUnit: 100,
    expiryMonths: 12,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
})

describe('upsertProgram — audit', () => {
  it('writes one LoyaltyProgram CREATE audit row when no prior row exists', async () => {
    mockPrisma.loyaltyProgram.findUnique.mockResolvedValue(null)

    await upsertProgram(BUSINESS_ID, USER_ID, INPUT)

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'LoyaltyProgram',
        entityId: 'prog-1',
        userId: USER_ID,
        action: 'CREATE',
      }),
    })
  })

  it('writes one LoyaltyProgram UPDATE audit row when row already exists', async () => {
    mockPrisma.loyaltyProgram.findUnique.mockResolvedValue({ id: 'prog-1', enabled: true })

    await upsertProgram(BUSINESS_ID, USER_ID, INPUT)

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'LoyaltyProgram',
        entityId: 'prog-1',
        userId: USER_ID,
        action: 'UPDATE',
      }),
    })
  })
})
