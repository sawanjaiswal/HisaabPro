/**
 * Settings backfill — audit-write smoke (PR7).
 *
 * Covers: app-settings, transaction-lock, approvals, pin (user + operation).
 * Each mutation must write ONE audit row inside its tx, carrying the userId
 * captured from req.user.userId at the route layer.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '../../../lib/prisma.js'
import { updateAppSettings } from '../app-settings.js'
import { updateTransactionLock } from '../transaction-lock.js'
import { reviewApproval } from '../approvals.js'
import { setPin, setOperationPin } from '../pin.js'

vi.mock('../../../lib/password.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
  verifyPassword: vi.fn().mockResolvedValue(true),
}))

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const BUSINESS_ID = 'biz-1'
const USER_ID = 'user-actor'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('updateAppSettings — audit', () => {
  it('writes one AppSettings UPDATE audit row with userId', async () => {
    mockPrisma.userAppSettings.upsert.mockResolvedValue({})

    await updateAppSettings(USER_ID, BUSINESS_ID, { theme: 'dark' })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'AppSettings',
        entityId: USER_ID,
        userId: USER_ID,
        action: 'UPDATE',
      }),
    })
  })
})

describe('updateTransactionLock — audit', () => {
  it('writes one TransactionLock UPDATE audit row with userId', async () => {
    mockPrisma.transactionLockConfig.upsert.mockResolvedValue({})

    await updateTransactionLock(BUSINESS_ID, USER_ID, { lockAfterDays: 7 })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'TransactionLock',
        entityId: BUSINESS_ID,
        userId: USER_ID,
        action: 'UPDATE',
      }),
    })
  })
})

describe('reviewApproval — audit', () => {
  it('writes one ApprovalPolicy APPROVAL_RESPONSE audit row with userId', async () => {
    mockPrisma.approvalRequest.findFirst.mockResolvedValue({
      id: 'app-1',
      expiresAt: new Date(Date.now() + 86400_000),
      type: 'PRICE_OVERRIDE',
    })
    mockPrisma.approvalRequest.update.mockResolvedValue({ id: 'app-1' })

    await reviewApproval(BUSINESS_ID, 'app-1', USER_ID, { action: 'APPROVE' })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'ApprovalPolicy',
        entityId: 'app-1',
        userId: USER_ID,
        action: 'APPROVAL_RESPONSE',
      }),
    })
  })
})

describe('setPin — audit', () => {
  it('writes one User PIN_RESET audit row with userId', async () => {
    mockPrisma.userAppSettings.findUnique.mockResolvedValue(null)
    mockPrisma.userAppSettings.upsert.mockResolvedValue({ pinEnabled: true })

    await setPin(USER_ID, BUSINESS_ID, { newPin: '1234' })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'User',
        entityId: USER_ID,
        userId: USER_ID,
        action: 'PIN_RESET',
      }),
    })
  })
})

describe('setOperationPin — audit', () => {
  it('writes one User PIN_RESET (OPERATION_PIN) audit row with userId', async () => {
    mockPrisma.transactionLockConfig.findUnique.mockResolvedValue(null)
    mockPrisma.transactionLockConfig.upsert.mockResolvedValue({})

    await setOperationPin(BUSINESS_ID, USER_ID, { newPin: '1234' })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'User',
        entityId: BUSINESS_ID,
        userId: USER_ID,
        action: 'PIN_RESET',
      }),
    })
  })
})
