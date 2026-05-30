/**
 * Waitlist service — add/list/remove + cross-tenant 404.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '../lib/prisma.js'
import {
  addToWaitlist,
  listWaitlist,
  removeFromWaitlist,
} from '../services/appointment-waitlist.service.js'

const scope = { businessId: 'biz1', userId: 'u1' }

describe('addToWaitlist', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates row with preferredDate=desiredStartAt and duration packed in notes', async () => {
    vi.mocked(prisma.party.findFirst).mockResolvedValue({
      id: 'p1',
      name: 'Acme',
      isActive: true,
    } as unknown as Awaited<ReturnType<typeof prisma.party.findFirst>>)
    vi.mocked(prisma.appointmentWaitlist.create).mockResolvedValue({
      id: 'w1',
      partyId: 'p1',
      employeeId: null,
      preferredDate: new Date('2026-06-01T10:00:00Z'),
      notes: '__dur:60__\n',
      createdAt: new Date('2026-05-30T00:00:00Z'),
    } as unknown as Awaited<ReturnType<typeof prisma.appointmentWaitlist.create>>)
    vi.mocked(prisma.party.findUnique).mockResolvedValue({
      name: 'Acme',
    } as unknown as Awaited<ReturnType<typeof prisma.party.findUnique>>)

    const row = await addToWaitlist(scope, {
      partyId: 'p1',
      employeeId: null,
      desiredStartAt: new Date('2026-06-01T10:00:00Z'),
      desiredEndAt: new Date('2026-06-01T11:00:00Z'),
      notes: null,
    })
    expect(row.id).toBe('w1')
    expect(row.partyNameSnapshot).toBe('Acme')
    expect(row.desiredStartAt).toBe('2026-06-01T10:00:00.000Z')
    expect(row.desiredEndAt).toBe('2026-06-01T11:00:00.000Z')

    const createArgs = vi.mocked(prisma.appointmentWaitlist.create).mock.calls[0]?.[0] as
      | { data: { businessId: string; preferredDate: Date; notes: string } }
      | undefined
    expect(createArgs?.data.businessId).toBe('biz1')
    expect(createArgs?.data.notes).toBe('__dur:60__\n')
  })

  it('404 when partyId belongs to another tenant', async () => {
    vi.mocked(prisma.party.findFirst).mockResolvedValue(null)
    await expect(
      addToWaitlist(scope, {
        partyId: 'p-other',
        employeeId: null,
        desiredStartAt: new Date('2026-06-01T10:00:00Z'),
        desiredEndAt: new Date('2026-06-01T11:00:00Z'),
        notes: null,
      })
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('listWaitlist', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns rows shaped as FE WaitlistRow', async () => {
    vi.mocked(prisma.appointmentWaitlist.findMany).mockResolvedValue([
      {
        id: 'w1',
        partyId: 'p1',
        employeeId: 'e1',
        preferredDate: new Date('2026-06-01T10:00:00Z'),
        notes: '__dur:90__\nfoo',
        createdAt: new Date('2026-05-30T00:00:00Z'),
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.appointmentWaitlist.findMany>>)
    vi.mocked(prisma.party.findUnique).mockResolvedValue({
      name: 'Acme',
    } as unknown as Awaited<ReturnType<typeof prisma.party.findUnique>>)

    const rows = await listWaitlist(scope, {})
    expect(rows).toHaveLength(1)
    expect(rows[0]?.desiredEndAt).toBe('2026-06-01T11:30:00.000Z') // +90min
    expect(rows[0]?.employeeId).toBe('e1')
  })
})

describe('removeFromWaitlist', () => {
  beforeEach(() => vi.clearAllMocks())

  it('404 cross-tenant on remove', async () => {
    vi.mocked(prisma.appointmentWaitlist.findFirst).mockResolvedValue(null)
    await expect(
      removeFromWaitlist(scope, 'w-other')
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('deletes when row is in scope', async () => {
    vi.mocked(prisma.appointmentWaitlist.findFirst).mockResolvedValue({
      id: 'w1',
    } as unknown as Awaited<ReturnType<typeof prisma.appointmentWaitlist.findFirst>>)
    vi.mocked(prisma.appointmentWaitlist.delete).mockResolvedValue({
      id: 'w1',
    } as unknown as Awaited<ReturnType<typeof prisma.appointmentWaitlist.delete>>)
    await expect(removeFromWaitlist(scope, 'w1')).resolves.toBeUndefined()
    expect(vi.mocked(prisma.appointmentWaitlist.delete)).toHaveBeenCalledWith({
      where: { id: 'w1' },
    })
  })
})
