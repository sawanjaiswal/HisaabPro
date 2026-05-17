/**
 * Test 12.9 — Loyalty expiry cron idempotency.
 *
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §2.7 (expiry job).
 *
 * Contract: running runLoyaltyExpiryCron twice over the SAME wall-clock window
 * must write zero new EX rows the second time. We assert this with the in-test
 * Prisma proxy by snapshotting the createMany call count + arg.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../lib/prisma.js'
import { runLoyaltyExpiryCron } from '../services/loyalty/loyalty-expiry.cron.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as unknown as Record<string, any>

const NOW = new Date('2026-06-01T00:00:00Z')
const PAST = new Date('2026-05-01T00:00:00Z')

const EXPIRED_AC_ROWS = [
  { id: 'ac-1', partyId: 'p-1', delta: 100 },
  { id: 'ac-2', partyId: 'p-2', delta: 250 },
]

beforeEach(() => {
  vi.resetAllMocks()
})

describe('runLoyaltyExpiryCron — test 12.9 idempotency', () => {
  it('first run writes EX rows; second run on same window writes ZERO', async () => {
    // ── First run setup ────────────────────────────────────────────
    mockPrisma.loyaltyLedger.findMany
      // call #1: distinct businesses with expired AC
      .mockResolvedValueOnce([{ businessId: 'biz-1' }])
      // call #2 (inside expireForBusiness): the expired AC rows
      .mockResolvedValueOnce(EXPIRED_AC_ROWS)
      // call #3: existing EX rows for those ACs (NONE on first run)
      .mockResolvedValueOnce([])

    mockPrisma.loyaltyLedger.createMany.mockResolvedValue({ count: 2 })

    const first = await runLoyaltyExpiryCron(NOW)
    expect(first.businessesProcessed).toBe(1)
    expect(first.totalAcExpired).toBe(2)
    expect(first.totalExWritten).toBe(2)

    // Snapshot of EX rows the cron wrote.
    const writtenEx = mockPrisma.loyaltyLedger.createMany.mock.calls[0][0].data as Array<{
      note: string
      type: string
      delta: number
    }>
    expect(writtenEx).toHaveLength(2)
    expect(writtenEx.every(r => r.type === 'EX')).toBe(true)
    expect(writtenEx.every(r => r.delta <= 0)).toBe(true)
    expect(writtenEx.map(r => r.note)).toEqual([
      '[expiry of ac:ac-1]',
      '[expiry of ac:ac-2]',
    ])

    // ── Second run on identical state ──────────────────────────────
    // Cron will see same expired ACs but findMany on type=EX now returns the
    // already-written EX rows — handled set becomes full, toInsert = [].
    mockPrisma.loyaltyLedger.findMany.mockReset()
    mockPrisma.loyaltyLedger.findMany
      .mockResolvedValueOnce([{ businessId: 'biz-1' }])
      .mockResolvedValueOnce(EXPIRED_AC_ROWS)
      .mockResolvedValueOnce(writtenEx.map(r => ({ note: r.note })))

    mockPrisma.loyaltyLedger.createMany.mockReset()

    const second = await runLoyaltyExpiryCron(NOW)
    expect(second.businessesProcessed).toBe(1)
    expect(second.totalAcExpired).toBe(2)
    expect(second.totalExWritten).toBe(0)
    expect(mockPrisma.loyaltyLedger.createMany).not.toHaveBeenCalled()
  })

  it('zero-expired short-circuits to 0/0/0', async () => {
    mockPrisma.loyaltyLedger.findMany.mockResolvedValueOnce([])
    const out = await runLoyaltyExpiryCron(NOW)
    expect(out).toEqual({ businessesProcessed: 0, totalAcExpired: 0, totalExWritten: 0 })
    expect(mockPrisma.loyaltyLedger.createMany).not.toHaveBeenCalled()
  })

  it('per-business isolation — one tenant error does not abort others', async () => {
    mockPrisma.loyaltyLedger.findMany
      .mockResolvedValueOnce([{ businessId: 'biz-bad' }, { businessId: 'biz-good' }])
      // biz-bad: findMany on AC throws
      .mockRejectedValueOnce(new Error('boom'))
      // biz-good: normal path — 1 expired AC, no existing EX
      .mockResolvedValueOnce([{ id: 'ac-3', partyId: 'p-3', delta: 50 }])
      .mockResolvedValueOnce([])

    mockPrisma.loyaltyLedger.createMany.mockResolvedValue({ count: 1 })

    const out = await runLoyaltyExpiryCron(PAST)
    expect(out.businessesProcessed).toBe(1) // only biz-good
    expect(out.totalExWritten).toBe(1)
  })
})
