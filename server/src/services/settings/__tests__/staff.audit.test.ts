/**
 * Staff service — audit-write smoke (PR7 backfill).
 *
 * Asserts inviteStaff writes one BusinessUser INVITE row, and removeStaff
 * writes one BusinessUser REMOVE row — both inside their respective tx.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { inviteStaff, removeStaff } from '../staff.js'
import { prisma } from '../../../lib/prisma.js'

vi.mock('../../../lib/token-blacklist.js', () => ({
  blacklistUser: vi.fn(),
  blacklistToken: vi.fn(),
  isBlacklisted: vi.fn().mockReturnValue(false),
  isUserBlacklisted: vi.fn().mockReturnValue(false),
}))

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const BUSINESS_ID = 'biz-1'
const USER_ID = 'user-actor'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('inviteStaff — audit', () => {
  it('writes one BusinessUser INVITE audit row with userId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.staffInvite.count.mockResolvedValue(0)
    mockPrisma.staffInvite.create.mockResolvedValue({
      id: 'inv-1',
      code: 'ABCDEF',
      expiresAt: new Date(),
      status: 'PENDING',
      name: 'Bob',
      phone: '9999900000',
    })

    mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-1' })

    await inviteStaff(BUSINESS_ID, USER_ID, { name: 'Bob', phone: '9999900000', roleId: 'role-1' })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'BusinessUser',
        entityId: 'inv-1',
        userId: USER_ID,
        action: 'INVITE',
      }),
    })
  })
})

describe('removeStaff — audit', () => {
  it('writes one BusinessUser REMOVE audit row with actorUserId', async () => {
    mockPrisma.businessUser.findFirst.mockResolvedValue({
      id: 'bu-1',
      role: 'member',
      userId: 'removed-user',
    })
    mockPrisma.businessUser.update.mockResolvedValue({ id: 'bu-1' })

    await removeStaff(BUSINESS_ID, 'bu-1', USER_ID)

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'BusinessUser',
        entityId: 'bu-1',
        userId: USER_ID,
        action: 'REMOVE',
      }),
    })
  })
})
