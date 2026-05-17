/**
 * Loyalty #125 — Redemption service unit tests.
 *
 * Test ids from architecture:
 *  - 12.1  happy-path redemption writes RD row with negative delta
 *  - 12.2  insufficient balance → 400 LOYALTY_INSUFFICIENT_BALANCE
 *  - 12.3  concurrent redemption (advisory lock fail) → 409
 *  - 12.15 program disabled → 400 LOYALTY_PROGRAM_DISABLED
 *  - 12.17 zero/negative points rejected → 400 LOYALTY_REDEMPTION_INVALID
 *
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §3.2 (FIFO oldest-AC),
 * §2.6 (advisory lock), §3.6 (error taxonomy).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../lib/prisma.js'
import { applyRedemption } from '../services/loyalty/loyalty-redeem.service.js'
import { AppError } from '../lib/errors.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mp = prisma as unknown as Record<string, any>

const CTX = {
  businessId: 'biz-1',
  partyId: 'p-1',
  posSaleId: 'pos-1',
  pointsRedeemed: 100,
  discountPaise: 10_000,
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('applyRedemption — test 12.1 happy path', () => {
  it('writes RD row with negative delta when balance sufficient', async () => {
    mp.loyaltyProgram.findUnique.mockResolvedValue({ enabled: true })
    mp.$queryRaw.mockResolvedValue([{ ok: true }]) // advisory lock acquired
    mp.loyaltyLedger.aggregate.mockResolvedValue({ _sum: { delta: 500 } })
    mp.loyaltyLedger.create.mockResolvedValue({ id: 'ledger-rd-1' })

    const tx = prisma as unknown as Parameters<typeof applyRedemption>[0]
    const result = await applyRedemption(tx, CTX)

    expect(result).toEqual({
      ledgerId: 'ledger-rd-1',
      pointsRedeemed: 100,
      discountPaise: 10_000,
      remainingPoints: 400,
    })
    expect(mp.loyaltyLedger.create).toHaveBeenCalledTimes(1)
    const args = mp.loyaltyLedger.create.mock.calls[0][0]
    expect(args.data.type).toBe('RD')
    expect(args.data.delta).toBe(-100) // negative
    expect(args.data.posSaleId).toBe('pos-1')
  })
})

describe('applyRedemption — test 12.2 insufficient balance', () => {
  it('throws 400 LOYALTY_INSUFFICIENT_BALANCE when balance < points', async () => {
    mp.loyaltyProgram.findUnique.mockResolvedValue({ enabled: true })
    mp.$queryRaw.mockResolvedValue([{ ok: true }])
    mp.loyaltyLedger.aggregate.mockResolvedValue({ _sum: { delta: 50 } })

    const tx = prisma as unknown as Parameters<typeof applyRedemption>[0]
    await expect(applyRedemption(tx, CTX)).rejects.toMatchObject({
      statusCode: 400,
      details: expect.objectContaining({
        reason: 'LOYALTY_INSUFFICIENT_BALANCE',
        available: 50,
        requested: 100,
      }),
    })
    expect(mp.loyaltyLedger.create).not.toHaveBeenCalled()
  })
})

describe('applyRedemption — test 12.3 concurrent redemption lock', () => {
  it('throws 409 LOYALTY_CONCURRENT_REDEMPTION when advisory lock fails', async () => {
    mp.loyaltyProgram.findUnique.mockResolvedValue({ enabled: true })
    mp.$queryRaw.mockResolvedValue([{ ok: false }]) // lock NOT acquired

    const tx = prisma as unknown as Parameters<typeof applyRedemption>[0]
    await expect(applyRedemption(tx, CTX)).rejects.toMatchObject({
      statusCode: 409,
      details: expect.objectContaining({ reason: 'LOYALTY_CONCURRENT_REDEMPTION' }),
    })
    expect(mp.loyaltyLedger.aggregate).not.toHaveBeenCalled()
    expect(mp.loyaltyLedger.create).not.toHaveBeenCalled()
  })
})

describe('applyRedemption — test 12.15 program disabled', () => {
  it('throws 400 LOYALTY_PROGRAM_DISABLED hard (vs accrual silent skip)', async () => {
    mp.loyaltyProgram.findUnique.mockResolvedValue({ enabled: false })

    const tx = prisma as unknown as Parameters<typeof applyRedemption>[0]
    let caught: unknown
    try { await applyRedemption(tx, CTX) } catch (e) { caught = e }
    expect(caught).toBeInstanceOf(AppError)
    const err = caught as AppError
    expect(err.statusCode).toBe(400)
    expect(err.details).toEqual(expect.objectContaining({
      reason: 'LOYALTY_PROGRAM_DISABLED',
    }))
    expect(mp.$queryRaw).not.toHaveBeenCalled()
  })

  it('throws 400 LOYALTY_PROGRAM_DISABLED when row missing', async () => {
    mp.loyaltyProgram.findUnique.mockResolvedValue(null)
    const tx = prisma as unknown as Parameters<typeof applyRedemption>[0]
    await expect(applyRedemption(tx, CTX)).rejects.toMatchObject({
      statusCode: 400,
      details: expect.objectContaining({ reason: 'LOYALTY_PROGRAM_DISABLED' }),
    })
  })
})

describe('applyRedemption — test 12.17 zero/negative points', () => {
  it('throws 400 LOYALTY_REDEMPTION_INVALID on pointsRedeemed=0', async () => {
    const tx = prisma as unknown as Parameters<typeof applyRedemption>[0]
    await expect(
      applyRedemption(tx, { ...CTX, pointsRedeemed: 0 })
    ).rejects.toMatchObject({
      statusCode: 400,
      details: expect.objectContaining({ reason: 'LOYALTY_REDEMPTION_INVALID' }),
    })
    expect(mp.loyaltyProgram.findUnique).not.toHaveBeenCalled()
  })

  it('throws 400 LOYALTY_REDEMPTION_INVALID on pointsRedeemed=-1', async () => {
    const tx = prisma as unknown as Parameters<typeof applyRedemption>[0]
    await expect(
      applyRedemption(tx, { ...CTX, pointsRedeemed: -1 })
    ).rejects.toMatchObject({
      statusCode: 400,
      details: expect.objectContaining({ reason: 'LOYALTY_REDEMPTION_INVALID' }),
    })
  })
})
