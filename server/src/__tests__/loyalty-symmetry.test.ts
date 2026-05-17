/**
 * Test 12.12 — POS void/restore writes symmetric VD/VR loyalty rows.
 *
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §3.4.1.
 *
 * Contract:
 *  voidForPosSale     — for every AC/RD row tied to this posSaleId,
 *                       write ONE inverse-delta VD row. Idempotent.
 *  restoreForPosSale  — for every VD row tied to this posSaleId,
 *                       write ONE inverse-delta VR row. Idempotent.
 *
 * Net result: ledger sums return to original values. Re-running void on an
 * already-voided sale writes zero rows.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../lib/prisma.js'
import { voidForPosSale, restoreForPosSale } from '../services/pos/pos-loyalty-symmetry.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mp = prisma as unknown as Record<string, any>

beforeEach(() => {
  vi.resetAllMocks()
})

describe('voidForPosSale (test 12.12)', () => {
  it('writes inverse-delta VD for every AC/RD row of the sale', async () => {
    mp.loyaltyLedger.findMany
      .mockResolvedValueOnce([
        { id: 'ac-1', partyId: 'p-1', delta: 100, type: 'AC' },
        { id: 'rd-1', partyId: 'p-1', delta: -40, type: 'RD' },
      ])
      .mockResolvedValueOnce([]) // no existing VD rows

    mp.loyaltyLedger.createMany.mockResolvedValue({ count: 2 })

    const tx = prisma as unknown as Parameters<typeof voidForPosSale>[0]
    const out = await voidForPosSale(tx, 'biz-1', 'pos-1')
    expect(out).toEqual({ acRdRowsFound: 2, vdRowsWritten: 2 })

    const writeArgs = mp.loyaltyLedger.createMany.mock.calls[0][0].data as Array<{
      type: string
      delta: number
      note: string
    }>
    expect(writeArgs.every(r => r.type === 'VD')).toBe(true)
    // AC(+100) → VD(-100), RD(-40) → VD(+40)
    expect(writeArgs.find(r => r.note === '[void of ac-1]')?.delta).toBe(-100)
    expect(writeArgs.find(r => r.note === '[void of rd-1]')?.delta).toBe(40)
  })

  it('idempotent — second run on already-voided sale writes zero', async () => {
    mp.loyaltyLedger.findMany
      .mockResolvedValueOnce([
        { id: 'ac-1', partyId: 'p-1', delta: 100, type: 'AC' },
      ])
      .mockResolvedValueOnce([{ note: '[void of ac-1]' }])

    const tx = prisma as unknown as Parameters<typeof voidForPosSale>[0]
    const out = await voidForPosSale(tx, 'biz-1', 'pos-1')
    expect(out).toEqual({ acRdRowsFound: 1, vdRowsWritten: 0 })
    expect(mp.loyaltyLedger.createMany).not.toHaveBeenCalled()
  })

  it('zero AC/RD rows short-circuits to {0,0}', async () => {
    mp.loyaltyLedger.findMany.mockResolvedValueOnce([])
    const tx = prisma as unknown as Parameters<typeof voidForPosSale>[0]
    const out = await voidForPosSale(tx, 'biz-1', 'pos-1')
    expect(out).toEqual({ acRdRowsFound: 0, vdRowsWritten: 0 })
    expect(mp.loyaltyLedger.createMany).not.toHaveBeenCalled()
  })
})

describe('restoreForPosSale (test 12.12 — reverse)', () => {
  it('writes inverse-delta VR for every VD row of the sale', async () => {
    mp.loyaltyLedger.findMany
      .mockResolvedValueOnce([
        { id: 'vd-1', partyId: 'p-1', delta: -100 },
      ])
      .mockResolvedValueOnce([]) // no existing VR

    mp.loyaltyLedger.createMany.mockResolvedValue({ count: 1 })

    const tx = prisma as unknown as Parameters<typeof restoreForPosSale>[0]
    const out = await restoreForPosSale(tx, 'biz-1', 'pos-1')
    expect(out).toEqual({ vdRowsFound: 1, vrRowsWritten: 1 })

    const writeArgs = mp.loyaltyLedger.createMany.mock.calls[0][0].data as Array<{
      type: string
      delta: number
      note: string
    }>
    expect(writeArgs[0]).toEqual(
      expect.objectContaining({
        type: 'VR',
        delta: 100, // inverse of VD's -100 — restores the original AC
        note: '[restore of vd-1]',
      })
    )
  })

  it('idempotent — second restore writes zero', async () => {
    mp.loyaltyLedger.findMany
      .mockResolvedValueOnce([{ id: 'vd-1', partyId: 'p-1', delta: -100 }])
      .mockResolvedValueOnce([{ note: '[restore of vd-1]' }])

    const tx = prisma as unknown as Parameters<typeof restoreForPosSale>[0]
    const out = await restoreForPosSale(tx, 'biz-1', 'pos-1')
    expect(out).toEqual({ vdRowsFound: 1, vrRowsWritten: 0 })
    expect(mp.loyaltyLedger.createMany).not.toHaveBeenCalled()
  })
})
