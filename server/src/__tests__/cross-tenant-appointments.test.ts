/**
 * Cross-tenant guard — every appointment-touching code path must 404 on a
 * cross-tenant input ID (NEVER 403, which would confirm the row exists).
 *
 * We exercise each resolver directly rather than spinning up the full
 * Express integration stack — the security invariant is "JOIN to
 * req.user.businessId BEFORE any further query", which lives in the
 * resolveScoped* helpers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '../lib/prisma.js'
import {
  resolveScopedParty,
  resolveScopedEmployee,
  resolveScopedAppointment,
} from '../middleware/resolve-scoped.js'
import { getAppointment } from '../services/appointment.service.js'
import { addToWaitlist } from '../services/appointment-waitlist.service.js'

describe('cross-tenant 404 guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolveScopedParty: 404 when partyId belongs to another tenant', async () => {
    vi.mocked(prisma.party.findFirst).mockResolvedValue(null)
    await expect(
      resolveScopedParty({ businessId: 'biz1' }, 'p-other')
    ).rejects.toMatchObject({ statusCode: 404 })
    // It MUST query with our businessId — never a raw id-only lookup.
    expect(vi.mocked(prisma.party.findFirst).mock.calls[0]?.[0]).toMatchObject({
      where: expect.objectContaining({ businessId: 'biz1' }),
    })
  })

  it('resolveScopedEmployee: 404 when cross-tenant', async () => {
    vi.mocked(prisma.employee.findFirst).mockResolvedValue(null)
    await expect(
      resolveScopedEmployee({ businessId: 'biz1' }, 'e-other')
    ).rejects.toMatchObject({ statusCode: 404 })
    expect(vi.mocked(prisma.employee.findFirst).mock.calls[0]?.[0]).toMatchObject({
      where: expect.objectContaining({ businessId: 'biz1' }),
    })
  })

  it('resolveScopedAppointment: 404 when cross-tenant', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    await expect(
      resolveScopedAppointment({ businessId: 'biz1' }, 'a-other')
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('getAppointment: 404 on cross-tenant id', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    await expect(
      getAppointment({ businessId: 'biz1', userId: 'u1' }, 'a-other')
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('addToWaitlist: 404 when partyId in another tenant', async () => {
    vi.mocked(prisma.party.findFirst).mockResolvedValue(null)
    await expect(
      addToWaitlist(
        { businessId: 'biz1', userId: 'u1' },
        {
          partyId: 'p-other',
          employeeId: null,
          desiredStartAt: new Date('2026-06-01T10:00:00Z'),
          desiredEndAt: new Date('2026-06-01T11:00:00Z'),
        }
      )
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
