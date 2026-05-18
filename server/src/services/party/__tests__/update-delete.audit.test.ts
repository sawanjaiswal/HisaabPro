/**
 * Party update-delete — audit-write smoke (PR7 backfill).
 *
 * Asserts the SSOT contract for `services/party/update-delete.ts`:
 *  - updateParty writes ONE auditLog row inside the same tx (action UPDATE)
 *  - deleteParty (soft path) writes ONE auditLog row (action DELETE, mode: soft)
 *  - deleteParty (force=true) writes ONE auditLog row (action DELETE, mode: hard)
 *
 * Uses the global Proxy-mocked prisma in __tests__/setup.ts — every model
 * method auto-stubs to vi.fn().
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { updateParty, deleteParty } from '../update-delete.js'
import { prisma } from '../../../lib/prisma.js'

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const BUSINESS_ID = 'biz-1'
const PARTY_ID = 'party-1'
const USER_ID = 'user-actor'

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.party.findFirst.mockResolvedValue({ id: PARTY_ID, name: 'Test Party' })
  mockPrisma.party.update.mockResolvedValue({ id: PARTY_ID, name: 'Test Party' })
  mockPrisma.party.delete.mockResolvedValue({ id: PARTY_ID })
})

describe('updateParty — audit', () => {
  it('writes one Party UPDATE audit row with userId + entityLabel', async () => {
    await updateParty(BUSINESS_ID, PARTY_ID, USER_ID, { name: 'New Name' })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'Party',
        entityId: PARTY_ID,
        userId: USER_ID,
        action: 'UPDATE',
      }),
    })
  })
})

describe('deleteParty — audit', () => {
  it('writes one Party DELETE audit row on soft delete', async () => {
    await deleteParty(BUSINESS_ID, PARTY_ID, USER_ID)

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'Party',
        entityId: PARTY_ID,
        userId: USER_ID,
        action: 'DELETE',
        changes: { mode: 'soft' },
      }),
    })
  })

  it('writes one Party DELETE audit row on hard delete', async () => {
    await deleteParty(BUSINESS_ID, PARTY_ID, USER_ID, true)

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'Party',
        entityId: PARTY_ID,
        userId: USER_ID,
        action: 'DELETE',
        changes: { mode: 'hard' },
      }),
    })
  })
})
