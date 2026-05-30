/**
 * Recurrence expansion tests — caps + frequency stepping.
 *
 * Most tests exercise the pure date arithmetic from utils to avoid Prisma
 * mocking gymnastics; the cap-rejection test exercises the public API.
 */

import { describe, it, expect, vi } from 'vitest'
import { prisma } from '../lib/prisma.js'
import { advanceByFreq } from '../utils/appointment.utils.js'
import { expandRecurrence } from '../services/appointment-recurrence.service.js'
import { MAX_RECURRENCE_OCCURRENCES } from '../constants/appointment.constants.js'

describe('advanceByFreq', () => {
  const base = new Date('2026-06-01T10:00:00Z')
  it('daily adds 1 day', () => {
    expect(advanceByFreq(base, 'DAILY').toISOString()).toBe('2026-06-02T10:00:00.000Z')
  })
  it('weekly adds 7 days', () => {
    expect(advanceByFreq(base, 'WEEKLY').toISOString()).toBe('2026-06-08T10:00:00.000Z')
  })
  it('monthly advances calendar month', () => {
    expect(advanceByFreq(base, 'MONTHLY').toISOString()).toBe('2026-07-01T10:00:00.000Z')
  })
})

describe('expandRecurrence', () => {
  it('rejects occurrences > MAX', async () => {
    await expect(
      expandRecurrence({
        businessId: 'b1',
        userId: 'u1',
        partyId: 'p1',
        employeeId: 'e1',
        startAt: new Date('2026-06-01T10:00:00Z'),
        endAt: new Date('2026-06-01T11:00:00Z'),
        frequency: 'WEEKLY',
        occurrences: MAX_RECURRENCE_OCCURRENCES + 1,
        recurrenceEndAt: new Date('2027-06-01T00:00:00Z'),
        vertical: 'salon',
      })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('creates template + iterates up to occurrences', async () => {
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
    vi.mocked(prisma.appointmentRecurrenceTemplate.create).mockResolvedValue({
      id: 't1',
    } as unknown as Awaited<ReturnType<typeof prisma.appointmentRecurrenceTemplate.create>>)
    let inserted = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(vi.mocked(prisma.appointment.create) as any).mockImplementation(async () => {
      inserted += 1
      return { id: `a-${inserted}` }
    })

    const result = await expandRecurrence({
      businessId: 'b1',
      userId: 'u1',
      partyId: 'p1',
      employeeId: 'e1',
      startAt: new Date('2026-06-01T10:00:00Z'),
      endAt: new Date('2026-06-01T11:00:00Z'),
      frequency: 'WEEKLY',
      occurrences: 3,
      recurrenceEndAt: new Date('2026-09-01T00:00:00Z'),
      vertical: 'salon',
    })
    expect(result.templateId).toBe('t1')
    expect(result.created).toHaveLength(3)
    expect(result.skipped).toHaveLength(0)
  })
})
