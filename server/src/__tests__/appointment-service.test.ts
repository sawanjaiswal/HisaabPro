/**
 * Service orchestration unit tests — cross-tenant 404, idempotency replay.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '../lib/prisma.js'
import { createAppointment } from '../services/appointment.service.js'

describe('createAppointment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when partyId belongs to another tenant', async () => {
    // resolveScopedParty: party.findFirst returns null (no match in scope)
    vi.mocked(prisma.party.findFirst).mockResolvedValue(null)
    await expect(
      createAppointment(
        { businessId: 'biz1', userId: 'user1' },
        {
          partyId: 'p-other-tenant',
          employeeId: 'e1',
          startAt: new Date('2026-06-01T10:00:00Z'),
          endAt: new Date('2026-06-01T11:00:00Z'),
        }
      )
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('replays existing row when idempotencyKey reused', async () => {
    const existing = {
      id: 'a-existing',
      businessId: 'biz1',
      idempotencyKey: 'k1',
    }
    vi.mocked(prisma.appointment.findFirst).mockResolvedValueOnce(
      existing as unknown as Awaited<ReturnType<typeof prisma.appointment.findFirst>>
    )

    const result = await createAppointment(
      { businessId: 'biz1', userId: 'user1' },
      {
        partyId: 'p1',
        employeeId: 'e1',
        startAt: new Date('2026-06-01T10:00:00Z'),
        endAt: new Date('2026-06-01T11:00:00Z'),
        idempotencyKey: 'k1',
      }
    )
    expect(result.id).toBe('a-existing')
    // party.findFirst must NOT have been called — replay shorts before scope resolve.
    expect(vi.mocked(prisma.party.findFirst)).not.toHaveBeenCalled()
  })

  it('creates a row when scope checks pass', async () => {
    // First findFirst: idempotency (none)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.party.findFirst).mockResolvedValue({
      id: 'p1',
      name: 'Raju',
      isActive: true,
    } as unknown as Awaited<ReturnType<typeof prisma.party.findFirst>>)
    vi.mocked(prisma.employee.findFirst).mockResolvedValue({
      id: 'e1',
      name: 'Priya',
      isDeleted: false,
    } as unknown as Awaited<ReturnType<typeof prisma.employee.findFirst>>)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      businessType: 'salon',
    } as unknown as Awaited<ReturnType<typeof prisma.business.findUnique>>)
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      id: 'a-new',
      partyNameSnapshot: 'Raju',
      employeeNameSnapshot: 'Priya',
      vertical: 'salon',
    } as unknown as Awaited<ReturnType<typeof prisma.appointment.create>>)

    const result = await createAppointment(
      { businessId: 'biz1', userId: 'user1' },
      {
        partyId: 'p1',
        employeeId: 'e1',
        startAt: new Date('2026-06-01T10:00:00Z'),
        endAt: new Date('2026-06-01T11:00:00Z'),
      }
    )
    expect(result.id).toBe('a-new')
    expect(result.partyNameSnapshot).toBe('Raju')
    expect(result.employeeNameSnapshot).toBe('Priya')
  })
})
