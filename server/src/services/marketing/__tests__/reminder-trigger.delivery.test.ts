/**
 * ORDER_DELIVERY reminder-trigger candidate tests (V5).
 * Day-granular: fires offsetDays before CustomOrder.deliveryAt.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { candidatesFor, normaliseToUtcMidnight } from '../reminder-trigger.service.js'
import { prisma } from '../../../lib/prisma.js'
import type { ReminderRule } from '@prisma/client'

const BUSINESS_ID = 'biz_1'

function makeRule(offsetDays: number): ReminderRule {
  return {
    businessId: BUSINESS_ID,
    trigger: 'ORDER_DELIVERY',
    offsetDays,
  } as unknown as ReminderRule
}

describe('orderDeliveryCandidates (via candidatesFor)', () => {
  beforeEach(() => {
    vi.mocked(prisma.customOrder.findMany).mockReset()
  })

  it('returns one candidate per order, fireDate = UTC-midnight of now+offsetDays', async () => {
    const now = new Date('2026-06-01T09:30:00.000Z')
    vi.mocked(prisma.customOrder.findMany).mockResolvedValue([
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

  it('dedupes multiple orders for the same party', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z')
    vi.mocked(prisma.customOrder.findMany).mockResolvedValue([
      { partyId: 'party_a' },
      { partyId: 'party_a' },
      { partyId: 'party_b' },
    ] as never)

    const out = await candidatesFor(makeRule(0), now)
    expect(out.map((c) => c.partyId)).toEqual(['party_a', 'party_b'])
  })

  it('scopes by business, soft-delete, pre-delivery status, and the day window', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z')
    vi.mocked(prisma.customOrder.findMany).mockResolvedValue([] as never)

    await candidatesFor(makeRule(2), now)

    const where = vi.mocked(prisma.customOrder.findMany).mock.calls[0][0]!.where as Record<string, unknown>
    expect(where.businessId).toBe(BUSINESS_ID)
    expect(where.isDeleted).toBe(false)
    expect(where.status).toEqual({ in: ['RECEIVED', 'IN_PRODUCTION', 'READY'] })

    const window = where.deliveryAt as { gte: Date; lt: Date }
    const start = new Date('2026-06-03T00:00:00.000Z') // now + 2 days, UTC midnight
    expect(window.gte.getTime()).toBe(start.getTime())
    expect(window.lt.getTime()).toBe(start.getTime() + 86_400_000)
  })
})
