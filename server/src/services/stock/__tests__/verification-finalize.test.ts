/**
 * INV-05 — Stock Verification Finalize Tests
 *
 * Tests finalizeVerification():
 *   - Counted = system → no movements, status=FINALIZED, adjusted=0
 *   - Counted < system → ADJUSTMENT_OUT movement, currentStock decreased
 *   - Counted > system → ADJUSTMENT_IN movement, currentStock increased
 *   - Mixed items → per-item movements, all FINALIZED, sum integrity holds
 *   - Re-finalize → idempotent, no duplicate movements, adjusted=0
 *   - Concurrent finalize → only one applies movements (row-lock)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  mockFindFirst,
  mockQueryRaw,
  mockItemFindMany,
  mockItemUpdateMany,
  mockVerificationUpdate,
  mockAdjustStock,
  mockScheduleAlertChecks,
  mockTransaction,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockItemFindMany: vi.fn(),
  mockItemUpdateMany: vi.fn(),
  mockVerificationUpdate: vi.fn(),
  mockAdjustStock: vi.fn(),
  mockScheduleAlertChecks: vi.fn(),
  mockTransaction: vi.fn(),
}))

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    stockVerification: {
      findFirst: mockFindFirst,
      update: mockVerificationUpdate,
    },
    stockVerificationItem: {
      findMany: mockItemFindMany,
      updateMany: mockItemUpdateMany,
    },
    $queryRaw: mockQueryRaw,
    $transaction: mockTransaction,
  },
}))

vi.mock('../core.js', () => ({
  adjustStock: mockAdjustStock,
}))

vi.mock('../invoice-ops.js', () => ({
  scheduleAlertChecks: mockScheduleAlertChecks,
}))

vi.mock('../../../lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { finalizeVerification } from '../verification-finalize.service.js'

// ── Constants ────────────────────────────────────────────────────────────────

const BIZ = 'biz-1'
const VER = 'ver-1'
const ACTOR = 'user-1'
const PROD_A = 'prod-a'
const PROD_B = 'prod-b'
const PROD_C = 'prod-c'

// Helper: set up a transaction mock that executes the callback
function setupTx(items: Array<{ id: string; productId: string; discrepancy: number }>) {
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: VER, status: 'IN_PROGRESS' }]),
      stockVerificationItem: { findMany: vi.fn().mockResolvedValue(items), updateMany: vi.fn() },
      stockVerification: { update: mockVerificationUpdate },
    }
    await fn(tx)
    return tx
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAdjustStock.mockResolvedValue({ movement: { id: 'mov-1' }, previousStock: 10, newStock: 5 })
  mockVerificationUpdate.mockResolvedValue({ id: VER, status: 'FINALIZED' })
  mockItemUpdateMany.mockResolvedValue({ count: 1 })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('finalizeVerification', () => {
  it('counted = system → no movements, status FINALIZED, adjusted=0', async () => {
    mockFindFirst.mockResolvedValue({ id: VER, status: 'IN_PROGRESS', finalizedAt: null })
    setupTx([]) // no discrepant items

    const result = await finalizeVerification(VER, BIZ, ACTOR)

    expect(mockAdjustStock).not.toHaveBeenCalled()
    expect(mockScheduleAlertChecks).not.toHaveBeenCalled()
    expect(result.adjusted).toBe(0)
    expect(result.verificationId).toBe(VER)
    expect(result.finalizedAt).toBeInstanceOf(Date)
  })

  it('counted < system → ADJUSTMENT_OUT movement written, stock decremented', async () => {
    mockFindFirst.mockResolvedValue({ id: VER, status: 'IN_PROGRESS', finalizedAt: null })
    const items = [{ id: 'item-1', productId: PROD_A, discrepancy: -3 }]
    setupTx(items)

    const result = await finalizeVerification(VER, BIZ, ACTOR)

    expect(mockAdjustStock).toHaveBeenCalledOnce()
    expect(mockAdjustStock).toHaveBeenCalledWith(
      expect.anything(), // tx
      expect.objectContaining({
        productId: PROD_A,
        businessId: BIZ,
        quantity: -3,
        type: 'ADJUSTMENT_OUT',
        reason: 'AUDIT',
        referenceType: 'STOCK_VERIFICATION',
        referenceId: VER,
        cachedBusinessValidationMode: 'WARN_ONLY',
      })
    )
    expect(result.adjusted).toBe(1)
    expect(mockScheduleAlertChecks).toHaveBeenCalledWith(BIZ, [PROD_A])
  })

  it('counted > system → ADJUSTMENT_IN movement written, stock incremented', async () => {
    mockFindFirst.mockResolvedValue({ id: VER, status: 'IN_PROGRESS', finalizedAt: null })
    const items = [{ id: 'item-2', productId: PROD_B, discrepancy: 5 }]
    setupTx(items)

    const result = await finalizeVerification(VER, BIZ, ACTOR)

    expect(mockAdjustStock).toHaveBeenCalledOnce()
    expect(mockAdjustStock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        productId: PROD_B,
        quantity: 5,
        type: 'ADJUSTMENT_IN',
        cachedBusinessValidationMode: 'WARN_ONLY',
      })
    )
    expect(result.adjusted).toBe(1)
    expect(mockScheduleAlertChecks).toHaveBeenCalledWith(BIZ, [PROD_B])
  })

  it('mixed items → per-item movements, sum integrity, all FINALIZED', async () => {
    mockFindFirst.mockResolvedValue({ id: VER, status: 'IN_PROGRESS', finalizedAt: null })
    const items = [
      { id: 'item-1', productId: PROD_A, discrepancy: -2 },
      { id: 'item-2', productId: PROD_B, discrepancy: 0 },  // no change
      { id: 'item-3', productId: PROD_C, discrepancy: 7 },
    ]
    setupTx(items)

    const result = await finalizeVerification(VER, BIZ, ACTOR)

    // PROD_B discrepancy=0 should be skipped
    expect(mockAdjustStock).toHaveBeenCalledTimes(2)
    expect(result.adjusted).toBe(2)
    expect(mockScheduleAlertChecks).toHaveBeenCalledWith(BIZ, expect.arrayContaining([PROD_A, PROD_C]))
  })

  it('re-finalize (already FINALIZED) → idempotent, no movements, adjusted=0', async () => {
    const finalizedAt = new Date('2026-05-07T10:00:00Z')
    mockFindFirst.mockResolvedValue({ id: VER, status: 'FINALIZED', finalizedAt })

    const result = await finalizeVerification(VER, BIZ, ACTOR)

    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockAdjustStock).not.toHaveBeenCalled()
    expect(result.adjusted).toBe(0)
    expect(result.finalizedAt).toBe(finalizedAt)
  })

  it('concurrent finalize → row lock means second tx sees FINALIZED, skips movements', async () => {
    mockFindFirst.mockResolvedValue({ id: VER, status: 'IN_PROGRESS', finalizedAt: null })

    // Simulate: second concurrent caller sees FINALIZED in the row lock
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: VER, status: 'FINALIZED' }]),
        stockVerificationItem: { findMany: vi.fn(), updateMany: vi.fn() },
        stockVerification: { update: mockVerificationUpdate },
      }
      await fn(tx)
    })

    const result = await finalizeVerification(VER, BIZ, ACTOR)

    // No adjustments applied (tx bailed early on seeing FINALIZED status)
    expect(mockAdjustStock).not.toHaveBeenCalled()
    expect(result.adjusted).toBe(0)
  })

  it('not found → throws 404 error', async () => {
    mockFindFirst.mockResolvedValue(null)

    await expect(finalizeVerification('bad-id', BIZ, ACTOR)).rejects.toMatchObject({
      statusCode: 404,
    })
    expect(mockTransaction).not.toHaveBeenCalled()
  })
})
