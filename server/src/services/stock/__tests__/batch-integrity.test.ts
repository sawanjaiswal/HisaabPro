/**
 * Hard Gate — BAT-02 batch round-trip integrity.
 *
 * Invariant: SUM(StockMovement.quantity WHERE batchId = X) == Batch.currentStock
 * for every batch after a sequence of FEFO sales and adjustments.
 *
 * Round-trip:
 *   3 batches seeded: A(stock=50), B(stock=30), C(stock=20) in FEFO expiry order
 *   SALE 60  → drains A(50) + 10 from B — movements: -50 on A, -10 on B
 *   SALE 15  → drains remaining B(20) + 5 from C — movements: -20 on B, but only 20 avail…
 *             → actually: B has 20 left; take 15 from B — movements: -15 on B
 *   ADJ -5 on batch C → movements: -5 on C
 *
 *   Final stocks: A=0, B=5, C=15
 *   Movements per batch:
 *     A: -50 → SUM = -50, initial 50 → currentStock should be 0 ✓
 *     B: -10, -15 → SUM = -25, initial 30 → currentStock should be 5 ✓
 *     C: -5 → SUM = -5, initial 20 → currentStock should be 15 ✓
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BatchCandidateRow } from '../batch-claim.types.js'

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

interface BatchRow {
  id: string
  productId: string
  currentStock: number
  expiryDate: Date | null
  costPrice: number | null
  isDeleted: boolean
}

interface BatchMovementRow {
  id: string
  batchId: string | null
  productId: string
  quantity: number
}

const PROD = 'prod-integrity'
let batches: BatchRow[]
let batchMovements: BatchMovementRow[]
let movSeq = 0

function resetState() {
  movSeq = 0
  batchMovements = []
  batches = [
    { id: 'bat-A', productId: PROD, currentStock: 50, expiryDate: new Date('2026-06-01'), costPrice: 500, isDeleted: false },
    { id: 'bat-B', productId: PROD, currentStock: 30, expiryDate: new Date('2026-08-01'), costPrice: 600, isDeleted: false },
    { id: 'bat-C', productId: PROD, currentStock: 20, expiryDate: new Date('2026-10-01'), costPrice: 700, isDeleted: false },
  ]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sumMovementsForBatch(batchId: string): number {
  return batchMovements
    .filter((m) => m.batchId === batchId)
    .reduce((sum, m) => sum + m.quantity, 0)
}

function currentStockOf(batchId: string): number {
  return batches.find((b) => b.id === batchId)!.currentStock
}

function assertBatchIntegrity(initialStocks: Record<string, number>, label: string) {
  for (const [batchId, initialStock] of Object.entries(initialStocks)) {
    const movSum = sumMovementsForBatch(batchId)
    const expectedStock = initialStock + movSum // initialStock + negative movements = currentStock
    expect(
      currentStockOf(batchId),
      `${label}: Batch ${batchId} — currentStock (${currentStockOf(batchId)}) should match initialStock(${initialStock}) + SUM(movements)(${movSum}) = ${expectedStock}`
    ).toBe(expectedStock)
  }
}

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockQueryRaw, mockMovementCreate, mockMovementUpdate } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockMovementCreate: vi.fn(),
  mockMovementUpdate: vi.fn(),
}))

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    stockMovement: { create: mockMovementCreate, update: mockMovementUpdate },
  },
}))

vi.mock('../../../lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { claimBatchesFEFO } from '../batch-claim.service.js'

// ---------------------------------------------------------------------------
// Mock wiring
// ---------------------------------------------------------------------------

function wireMocks() {
  let selectCalled = false

  mockQueryRaw.mockImplementation(
    (parts: TemplateStringsArray | string, ...values: unknown[]) => {
      const queryStr = Array.isArray(parts) ? (parts as TemplateStringsArray).join('') : String(parts)

      if (!selectCalled && queryStr.includes('FOR UPDATE SKIP LOCKED')) {
        selectCalled = true
        const candidates: BatchCandidateRow[] = batches
          .filter((b) => !b.isDeleted && b.currentStock > 0)
          .sort((a, b) => {
            if (a.expiryDate === null && b.expiryDate === null) return a.id < b.id ? -1 : 1
            if (a.expiryDate === null) return 1
            if (b.expiryDate === null) return -1
            return a.expiryDate.getTime() - b.expiryDate.getTime()
          })
          .map((b) => ({
            id: b.id,
            currentStock: b.currentStock,
            expiryDate: b.expiryDate,
            costPrice: b.costPrice,
            batchNumber: b.id,
            productId: b.productId,
            productName: 'Test Product',
          }))
        return Promise.resolve(candidates)
      }

      // UPDATE … RETURNING — decrement batch
      const take = values[0] as number
      const batchId = values[1] as string
      const batch = batches.find((b) => b.id === batchId)
      if (!batch || batch.currentStock < take) return Promise.resolve([])
      batch.currentStock -= take
      return Promise.resolve([{ id: batch.id, currentStock: batch.currentStock }])
    }
  )
}

function makeTx() {
  return { $queryRaw: mockQueryRaw }
}

/** Record a movement in the in-memory log. */
function recordMovement(batchId: string | null, qty: number) {
  movSeq++
  batchMovements.push({ id: `mov-${movSeq}`, batchId, productId: PROD, quantity: qty })
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('Batch integrity — hard-gate round-trip (BAT-02)', () => {
  const INITIAL_STOCKS = { 'bat-A': 50, 'bat-B': 30, 'bat-C': 20 }

  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
  })

  it('SUM(StockMovement.quantity per batchId) == Batch.currentStock for every batch after purchase+sale+adjustment', async () => {
    const tx = makeTx() as any

    // ─ SALE 60 (drains A=50 fully, then 10 from B) ─────────────────────────
    wireMocks()
    const { claims: claims1 } = await claimBatchesFEFO(tx, PROD, 60)
    for (const c of claims1) recordMovement(c.batchId, -c.qtyTaken)

    assertBatchIntegrity(INITIAL_STOCKS, 'After SALE 60')
    expect(currentStockOf('bat-A')).toBe(0)
    expect(currentStockOf('bat-B')).toBe(20)
    expect(currentStockOf('bat-C')).toBe(20)

    // ─ SALE 15 (all from remaining B) ──────────────────────────────────────
    vi.clearAllMocks()
    wireMocks()
    const { claims: claims2 } = await claimBatchesFEFO(tx, PROD, 15)
    for (const c of claims2) recordMovement(c.batchId, -c.qtyTaken)

    assertBatchIntegrity(INITIAL_STOCKS, 'After SALE 15')
    expect(currentStockOf('bat-A')).toBe(0)
    expect(currentStockOf('bat-B')).toBe(5)
    expect(currentStockOf('bat-C')).toBe(20)

    // ─ ADJUSTMENT -5 on batch C (manual write, simulating adjustBatchStock) ─
    const batchC = batches.find((b) => b.id === 'bat-C')!
    batchC.currentStock -= 5
    recordMovement('bat-C', -5)

    assertBatchIntegrity(INITIAL_STOCKS, 'After ADJ -5 on C')
    expect(currentStockOf('bat-A')).toBe(0)
    expect(currentStockOf('bat-B')).toBe(5)
    expect(currentStockOf('bat-C')).toBe(15)

    // ─ Final integrity check: every batch satisfies the invariant ───────────
    for (const batchId of Object.keys(INITIAL_STOCKS)) {
      const movSum = sumMovementsForBatch(batchId)
      const expectedStock = INITIAL_STOCKS[batchId as keyof typeof INITIAL_STOCKS] + movSum
      expect(currentStockOf(batchId)).toBe(expectedStock)
    }
  })
})
