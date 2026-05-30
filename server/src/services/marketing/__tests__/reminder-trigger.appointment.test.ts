/**
 * APPOINTMENT_UPCOMING reminder-trigger candidate tests (V2 Appointments Phase 1C).
 * Day-granular: fires offsetDays before Appointment.startAt.
 * Mirrors the ORDER_DELIVERY shape (reminder-trigger.delivery.test.ts).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { candidatesFor, normaliseToUtcMidnight } from '../reminder-trigger.service.js'
import { prisma } from '../../../lib/prisma.js'
import type { ReminderRule } from '@prisma/client'

const BUSINESS_ID = 'biz_1'

function makeRule(offsetDays: number): ReminderRule {
  return {
    id: 'rule_appt_1',
    businessId: BUSINESS_ID,
    trigger: 'APPOINTMENT_UPCOMING',
    offsetDays,
  } as unknown as ReminderRule
}

describe('appointmentUpcomingCandidates (via candidatesFor)', () => {
  beforeEach(() => {
    vi.mocked(prisma.appointment.findMany).mockReset()
  })

  it('returns one candidate per appointment, fireDate = UTC-midnight of now+offsetDays', async () => {
    const now = new Date('2026-06-01T09:30:00.000Z')
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { partyId: 'party_a' },
      { partyId: 'party_b' },
    ] as never)

    const out = await candidatesFor(makeRule(1), now)

    const expectedFire = normaliseToUtcMidnight(new Date('2026-06-02T09:30:00.000Z'))
    expect(out).toEqual([
      { partyId: 'party_a', fireDate: expectedFire },
      { partyId: 'party_b', fireDate: expectedFire },
    ])
  })

  it('dedupes multiple appointments for the same party', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z')
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { partyId: 'party_a' },
      { partyId: 'party_a' },
      { partyId: 'party_b' },
    ] as never)

    const out = await candidatesFor(makeRule(0), now)
    expect(out.map((c) => c.partyId)).toEqual(['party_a', 'party_b'])
  })

  it('excludes partyId-null rows (anonymous public bookings without a Party link)', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z')
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { partyId: 'party_a' },
      { partyId: null },
      { partyId: 'party_b' },
    ] as never)

    const out = await candidatesFor(makeRule(0), now)
    expect(out.map((c) => c.partyId)).toEqual(['party_a', 'party_b'])
  })

  it('scopes by business, SCHEDULED+CONFIRMED only, partyId-not-null, and the day window', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z')
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([] as never)

    await candidatesFor(makeRule(2), now)

    const where = vi.mocked(prisma.appointment.findMany).mock.calls[0][0]!.where as Record<string, unknown>
    expect(where.businessId).toBe(BUSINESS_ID)
    // SCHEDULED + CONFIRMED only — terminal states (CANCELLED / NO_SHOW / COMPLETED)
    // and in-flight states (CHECKED_IN / IN_PROGRESS) must NOT receive a "you have
    // an upcoming appointment" reminder.
    expect(where.status).toEqual({ in: ['SCHEDULED', 'CONFIRMED'] })
    expect(where.partyId).toEqual({ not: null })

    const window = where.startAt as { gte: Date; lt: Date }
    const start = new Date('2026-06-03T00:00:00.000Z') // now + 2 days, UTC midnight
    expect(window.gte.getTime()).toBe(start.getTime())
    expect(window.lt.getTime()).toBe(start.getTime() + 86_400_000)
  })

  it('tick replay is safe: same call twice returns the same candidate set (cross-tick dedup is enforced by ReminderInstance unique (ruleId, partyId, fireDate) at insert time, not here)', async () => {
    const now = new Date('2026-06-01T09:30:00.000Z')
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { partyId: 'party_a' },
    ] as never)

    const first = await candidatesFor(makeRule(1), now)
    const second = await candidatesFor(makeRule(1), now)

    // Same fireDate across replays → createMany({ skipDuplicates: true }) in
    // reminder-cron will silently drop the second insert; no double-dispatch.
    expect(first).toEqual(second)
    expect(first[0]?.fireDate.getTime()).toBe(second[0]?.fireDate.getTime())
  })
})
