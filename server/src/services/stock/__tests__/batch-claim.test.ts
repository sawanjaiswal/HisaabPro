/**
 * BAT-02 — FEFO Batch Claim Tests
 *
 * 8 cases:
 *   1. Single batch sufficient — full qty from one batch
 *   2. Multi-batch split — FEFO order (earliest expiry first)
 *   3. Expired batch — currently respected via filter in BAT-03; BAT-02 trusts caller to pass only
 *      valid candidates (architectural note: expiry filter added in BAT-03 WHERE clause)
 *   4. TOCTOU concurrent claim — second tx sees 0 rows from UPDATE, falls back to next batch
 *   5. Zero-stock batch skipped — SELECT WHERE currentStock > 0 excludes it
 *   6. Deleted batch skipped — SELECT WHERE isDeleted = false excludes it
 *   7. Insufficient total — throws INSUFFICIENT_BATCH_STOCK when sum < requested
 *   8. Null expiryDate sorts last — ORDER BY expiryDate ASC NULLS LAST
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
// BatchCandidateRow import removed — now using extended row shape inline (BAT-03)

// ---------------------------------------------------------------------------
// In-memory batch state
// ---------------------------------------------------------------------------

interface BatchRow {
  id: string
  productId: string
  currentStock: number
  expiryDate: Date | null
  costPrice: number | null
  isDeleted: boolean
}

const PROD = 'prod-bat-02'

let batches: BatchRow[]

function resetState() {
  batches = []
}

function seedBatch(overrides: Partial<BatchRow> & Pick<BatchRow, 'id'>): BatchRow {
  const row: BatchRow = {
    productId: PROD,
    currentStock: 100,
    expiryDate: null,
    costPrice: null,
    isDeleted: false,
    ...overrides,
  }
  batches.push(row)
  return row
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
    stockMovement: {
      create: mockMovementCreate,
      update: mockMovementUpdate,
    },
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
// Mock TX factory
// ---------------------------------------------------------------------------

function makeTx() {
  return {
    $queryRaw: mockQueryRaw,
    stockMovement: {
      create: mockMovementCreate,
      update: mockMovementUpdate,
    },
    stockAlert: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  }
}

// ---------------------------------------------------------------------------
// Wire helpers
// ---------------------------------------------------------------------------

/**
 * Wires mockQueryRaw to:
 *   - First call (SELECT … FOR UPDATE SKIP LOCKED): return FEFO-sorted in-stock batches.
 *   - Subsequent calls (UPDATE … WHERE currentStock >= take RETURNING): atomically decrement
 *     in-memory state. Returns [] to simulate a TOCTOU race when `toctouBatchId` is set.
 */
function wireMocks(opts: { toctouBatchId?: string } = {}) {
  let selectCalled = false

  mockQueryRaw.mockImplementation(
    (parts: TemplateStringsArray | string, ...values: unknown[]) => {
      // Determine query type by first template segment
      const queryStr = Array.isArray(parts) ? (parts as TemplateStringsArray).join('') : String(parts)

      if (!selectCalled && queryStr.includes('FOR UPDATE SKIP LOCKED')) {
        selectCalled = true

        // Return only in-stock, non-deleted batches in FEFO order
        // BAT-03: include batchNumber, productId, productName for expiry-policy evaluator
        const candidates = batches
          .filter((b) => !b.isDeleted && b.currentStock > 0)
          .sort((a, b) => {
            // NULLS LAST: null expiry sorts after all dated batches
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

      // UPDATE … RETURNING — find the batchId from values array
      // values pattern: [take, batchId] based on the parameterized query
      const take = values[0] as number
      const batchId = values[1] as string

      // Simulate TOCTOU: return empty for the designated race batch
      if (opts.toctouBatchId === batchId) {
        return Promise.resolve([])
      }

      const batch = batches.find((b) => b.id === batchId)
      if (!batch || batch.currentStock < take) {
        return Promise.resolve([])
      }

      batch.currentStock -= take
      return Promise.resolve([{ id: batch.id, currentStock: batch.currentStock }])
    }
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('claimBatchesFEFO — BAT-02', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
  })

  // ── Case 1: Single batch sufficient ───────────────────────────────────────

  it('case 1: single batch — claims full quantity from one batch', async () => {
    seedBatch({ id: 'bat-a', currentStock: 50, costPrice: 500 })
    wireMocks()

    const tx = makeTx() as any
    const { claims } = await claimBatchesFEFO(tx, PROD, 30)

    expect(claims).toHaveLength(1)
    expect(claims[0].batchId).toBe('bat-a')
    expect(claims[0].qtyTaken).toBe(30)
    expect(claims[0].costPriceAtClaim).toBe(BigInt(500))
    // In-memory batch should be decremented
    expect(batches[0].currentStock).toBe(20)
  })

  // ── Case 2: Multi-batch split in FEFO order ───────────────────────────────

  it('case 2: multi-batch FEFO — splits across batches, earliest expiry first', async () => {
    const later = new Date('2026-08-01')
    const sooner = new Date('2026-06-01')

    // Add in reverse order — FEFO should still sort by expiryDate
    seedBatch({ id: 'bat-later', currentStock: 40, expiryDate: later, costPrice: 1000 })
    seedBatch({ id: 'bat-sooner', currentStock: 30, expiryDate: sooner, costPrice: 800 })
    wireMocks()

    const tx = makeTx() as any
    const { claims } = await claimBatchesFEFO(tx, PROD, 50)

    // Should drain sooner batch first (FEFO)
    expect(claims).toHaveLength(2)
    expect(claims[0].batchId).toBe('bat-sooner')
    expect(claims[0].qtyTaken).toBe(30)
    expect(claims[1].batchId).toBe('bat-later')
    expect(claims[1].qtyTaken).toBe(20)

    expect(batches.find((b) => b.id === 'bat-sooner')!.currentStock).toBe(0)
    expect(batches.find((b) => b.id === 'bat-later')!.currentStock).toBe(20)
  })

  // ── Case 3: Expired batch — SELECT WHERE currentStock > 0 only ───────────
  // Note: expiry DATE filter is added by BAT-03's HARD_BLOCK policy SQL.
  // BAT-02 tests the NULLS LAST ordering behavior with a past expiryDate to
  // confirm ordering logic (expiry filter enforcement is BAT-03 scope).

  it('case 3: batches are ordered correctly even with past expiryDate (expiry filter in BAT-03)', async () => {
    const past = new Date('2025-01-01')
    const future = new Date('2026-12-01')
    seedBatch({ id: 'bat-expired', currentStock: 20, expiryDate: past })
    seedBatch({ id: 'bat-fresh', currentStock: 80, expiryDate: future })
    wireMocks()

    const tx = makeTx() as any
    const { claims } = await claimBatchesFEFO(tx, PROD, 25)

    // Past date sorts before future date in ASC order — expired batch claimed first
    expect(claims[0].batchId).toBe('bat-expired')
    expect(claims[0].qtyTaken).toBe(20)
    expect(claims[1].batchId).toBe('bat-fresh')
    expect(claims[1].qtyTaken).toBe(5)
  })

  // ── Case 4: TOCTOU — concurrent claim, fallback to next batch ────────────

  it('case 4: TOCTOU race — second tx loses one batch, falls back to next', async () => {
    seedBatch({ id: 'bat-raced', currentStock: 40, expiryDate: new Date('2026-06-01') })
    seedBatch({ id: 'bat-fallback', currentStock: 60, expiryDate: new Date('2026-08-01') })
    // Simulate: bat-raced was claimed by another tx between SELECT and UPDATE
    wireMocks({ toctouBatchId: 'bat-raced' })

    const tx = makeTx() as any
    const { claims } = await claimBatchesFEFO(tx, PROD, 30)

    // Should skip bat-raced (UPDATE returns 0 rows) and claim from bat-fallback
    expect(claims).toHaveLength(1)
    expect(claims[0].batchId).toBe('bat-fallback')
    expect(claims[0].qtyTaken).toBe(30)
  })

  // ── Case 5: Zero-stock batch skipped ─────────────────────────────────────

  it('case 5: zero-stock batch — excluded from SELECT, not returned as candidate', async () => {
    seedBatch({ id: 'bat-empty', currentStock: 0 })
    seedBatch({ id: 'bat-full', currentStock: 50, costPrice: 900 })
    wireMocks()

    const tx = makeTx() as any
    const { claims } = await claimBatchesFEFO(tx, PROD, 20)

    expect(claims).toHaveLength(1)
    expect(claims[0].batchId).toBe('bat-full')
    // bat-empty was never returned by the SELECT mock (currentStock > 0 filter)
  })

  // ── Case 6: Deleted batch skipped ────────────────────────────────────────

  it('case 6: deleted batch — excluded from SELECT, not returned as candidate', async () => {
    seedBatch({ id: 'bat-deleted', currentStock: 100, isDeleted: true })
    seedBatch({ id: 'bat-active', currentStock: 40, costPrice: 700 })
    wireMocks()

    const tx = makeTx() as any
    const { claims } = await claimBatchesFEFO(tx, PROD, 20)

    expect(claims).toHaveLength(1)
    expect(claims[0].batchId).toBe('bat-active')
  })

  // ── Case 7: Insufficient total — throws INSUFFICIENT_BATCH_STOCK ──────────

  it('case 7: insufficient total stock — throws INSUFFICIENT_BATCH_STOCK', async () => {
    seedBatch({ id: 'bat-small-a', currentStock: 10 })
    seedBatch({ id: 'bat-small-b', currentStock: 15 })
    wireMocks()

    const tx = makeTx() as any

    await expect(claimBatchesFEFO(tx, PROD, 50)).rejects.toMatchObject({
      statusCode: 409,
      details: expect.objectContaining({
        code: 'INSUFFICIENT_BATCH_STOCK',
        requested: 50,
        claimed: 25,
      }),
    })
  })

  // ── Case 8: Null expiryDate sorts last ───────────────────────────────────

  it('case 8: null expiryDate sorts after all dated batches (NULLS LAST)', async () => {
    seedBatch({ id: 'bat-no-expiry', currentStock: 50, expiryDate: null })
    seedBatch({ id: 'bat-expiring', currentStock: 30, expiryDate: new Date('2026-06-01') })
    wireMocks()

    const tx = makeTx() as any
    const { claims } = await claimBatchesFEFO(tx, PROD, 40)

    // bat-expiring (dated) should come before bat-no-expiry (null = NULLS LAST)
    expect(claims[0].batchId).toBe('bat-expiring')
    expect(claims[0].qtyTaken).toBe(30)
    expect(claims[1].batchId).toBe('bat-no-expiry')
    expect(claims[1].qtyTaken).toBe(10)
  })
})
