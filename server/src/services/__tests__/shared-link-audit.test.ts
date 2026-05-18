/**
 * Shared-link service — audit-write smoke (PR7 backfill).
 *
 * Asserts revokeSharedLink writes ONE SharedLink REVOKE audit row inside
 * its tx, with userId set from the route layer.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { revokeSharedLink } from '../shared-link.service.js'
import { prisma } from '../../lib/prisma.js'

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const BUSINESS_ID = 'biz-1'
const LINK_ID = 'link-1'
const USER_ID = 'user-actor'

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.sharedLink.update.mockResolvedValue({
    id: LINK_ID,
    resourceType: 'INVOICE',
    resourceId: 'doc-1',
    businessId: BUSINESS_ID,
    tokenHash: 'hash',
    issuedById: 'someone',
    expiresAt: null,
    revokedAt: new Date(),
    accessCount: 0,
    metadata: null,
    createdAt: new Date(),
  })
})

describe('revokeSharedLink — audit', () => {
  it('writes one SharedLink REVOKE audit row with userId', async () => {
    await revokeSharedLink({ id: LINK_ID, businessId: BUSINESS_ID, userId: USER_ID })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'SharedLink',
        entityId: LINK_ID,
        userId: USER_ID,
        action: 'REVOKE',
      }),
    })
  })
})
