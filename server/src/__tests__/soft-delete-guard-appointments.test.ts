/**
 * Soft-delete guard tests — party + employee delete must 409 when active
 * appointments exist.
 *
 * We exercise the repo helpers + the existing service entrypoints. The
 * service mocking surface is heavy here (each delete runs a full audit-log
 * tx), so we focus on the count-based predicate that fires the 409.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '../lib/prisma.js'
import {
  countActiveByParty,
  countActiveByEmployee,
} from '../services/appointment-repo.js'

describe('countActiveByParty', () => {
  beforeEach(() => vi.clearAllMocks())

  it('counts SCHEDULED/CONFIRMED/CHECKED_IN/IN_PROGRESS only', async () => {
    vi.mocked(prisma.appointment.count).mockResolvedValue(3)
    const result = await countActiveByParty(prisma, 'biz1', 'p1')
    expect(result).toBe(3)
    expect(vi.mocked(prisma.appointment.count).mock.calls[0]?.[0]).toMatchObject({
      where: expect.objectContaining({
        businessId: 'biz1',
        partyId: 'p1',
        status: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
      }),
    })
  })

  it('returns 0 when no active rows', async () => {
    vi.mocked(prisma.appointment.count).mockResolvedValue(0)
    expect(await countActiveByParty(prisma, 'biz1', 'p1')).toBe(0)
  })
})

describe('countActiveByEmployee', () => {
  beforeEach(() => vi.clearAllMocks())

  it('counts by employeeId in active statuses', async () => {
    vi.mocked(prisma.appointment.count).mockResolvedValue(2)
    const result = await countActiveByEmployee(prisma, 'biz1', 'e1')
    expect(result).toBe(2)
    expect(vi.mocked(prisma.appointment.count).mock.calls[0]?.[0]).toMatchObject({
      where: expect.objectContaining({
        businessId: 'biz1',
        employeeId: 'e1',
      }),
    })
  })
})
