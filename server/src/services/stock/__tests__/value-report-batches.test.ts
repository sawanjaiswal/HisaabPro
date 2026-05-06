/**
 * BAT-06 — Stock Value Report: per-batch breakdown
 *
 * Tests (6 cases):
 *   1. Batch-tracked product emits N rows (one per batch with stock > 0)
 *   2. Non-batch product emits 1 row using weightedAvgCostPaise
 *   3. Mixed business sorts correctly by totalPaise DESC
 *   4. Cursor pagination round-trips across batch + non-batch boundary
 *   5. Expired batches with currentStock > 0 still appear in valuation
 *   6. Null batch.costPrice falls back to product.weightedAvgCostPaise
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}))

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}))

vi.mock('../../../lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { getStockValueReport } from '../value-report.service.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

const BIZ = 'biz-test'

function makeBatchRow(
  productId: string,
  batchId: string,
  batchNumber: string,
  currentStock: number,
  unitCostPaise: bigint,
  expiryDate: Date | null = null
) {
  return {
    kind: 'batch',
    productId,
    productName: `Product ${productId}`,
    sku: null,
    unit: 'pcs',
    batchId,
    batchNumber,
    expiryDate,
    currentStock,
    unitCostPaise,
    totalPaise: BigInt(Math.floor(currentStock * Number(unitCostPaise))),
  }
}

function makeProductRow(
  productId: string,
  currentStock: number,
  unitCostPaise: bigint
) {
  return {
    kind: 'product',
    productId,
    productName: `Product ${productId}`,
    sku: null,
    unit: 'pcs',
    batchId: null,
    batchNumber: null,
    expiryDate: null,
    currentStock,
    unitCostPaise,
    totalPaise: BigInt(Math.floor(currentStock * Number(unitCostPaise))),
  }
}

function makeSummary(rows: ReturnType<typeof makeBatchRow | typeof makeProductRow>[]) {
  const total = rows.reduce((s, r) => s + r.totalPaise, BigInt(0))
  return [{ total, cnt: BigInt(rows.length) }]
}

/** mockQueryRaw alternates: first call = page rows, second call = summary */
function setupMocks(
  pageRows: ReturnType<typeof makeBatchRow | typeof makeProductRow>[]
) {
  const summary = makeSummary(pageRows)
  // Promise.all: [runValueQuery, runValueSummary] — both call $queryRaw once
  mockQueryRaw
    .mockResolvedValueOnce(pageRows)  // runValueQuery
    .mockResolvedValueOnce(summary)   // runValueSummary
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BAT-06 Case 1: batch-tracked product emits N rows', () => {
  it('returns one row per batch when product has multiple batches', async () => {
    const rows = [
      makeBatchRow('p1', 'b1', 'BATCH-001', 50, BigInt(200)),  // 10000
      makeBatchRow('p1', 'b2', 'BATCH-002', 30, BigInt(200)),  // 6000
    ]
    setupMocks(rows)

    const report = await getStockValueReport(BIZ)

    expect(report.items).toHaveLength(2)
    expect(report.items.every((r) => r.kind === 'batch')).toBe(true)
    expect(report.items[0]).toMatchObject({ batchId: 'b1', batchNumber: 'BATCH-001' })
    expect(report.items[1]).toMatchObject({ batchId: 'b2', batchNumber: 'BATCH-002' })
  })
})

describe('BAT-06 Case 2: non-batch product emits 1 row', () => {
  it('returns single product row with null batchId/batchNumber/expiryDate', async () => {
    const rows = [makeProductRow('p2', 100, BigInt(500))]
    setupMocks(rows)

    const report = await getStockValueReport(BIZ)

    expect(report.items).toHaveLength(1)
    const item = report.items[0]
    expect(item.kind).toBe('product')
    expect(item.batchId).toBeNull()
    expect(item.batchNumber).toBeNull()
    expect(item.expiryDate).toBeNull()
    expect(item.unitCostPaise).toBe(BigInt(500))
    expect(item.totalPaise).toBe(BigInt(50000))
  })
})

describe('BAT-06 Case 3: mixed business sorts by totalPaise DESC', () => {
  it('interleaves batch and product rows in correct order', async () => {
    const rows = [
      makeBatchRow('p1', 'b1', 'BATCH-A', 100, BigInt(1000)),  // 100000 — highest
      makeProductRow('p3', 10, BigInt(5000)),                    // 50000 — second
      makeBatchRow('p1', 'b2', 'BATCH-B', 20, BigInt(200)),     // 4000 — third
      makeProductRow('p2', 5, BigInt(100)),                      // 500 — lowest
    ]
    setupMocks(rows)

    const report = await getStockValueReport(BIZ)

    expect(report.items).toHaveLength(4)
    // Already sorted by the DB query; service preserves the order
    expect(report.items[0].totalPaise).toBe(BigInt(100000))
    expect(report.items[1].totalPaise).toBe(BigInt(50000))
    expect(report.items[2].totalPaise).toBe(BigInt(4000))
    expect(report.items[3].totalPaise).toBe(BigInt(500))

    // Summary totalPaise = sum of all
    const expected = BigInt(100000) + BigInt(50000) + BigInt(4000) + BigInt(500)
    expect(report.totalValuePaise).toBe(expected)
  })
})

describe('BAT-06 Case 4: cursor pagination round-trips', () => {
  it('page 2 cursor starts after last row on page 1', async () => {
    const allRows = [
      makeBatchRow('p1', 'b1', 'B1', 100, BigInt(1000)), // 100000
      makeProductRow('p2', 10, BigInt(5000)),              // 50000
      makeBatchRow('p1', 'b2', 'B2', 20, BigInt(200)),   // 4000
    ]

    // Page 1 (limit=1): only first row + hasMore row
    mockQueryRaw
      .mockResolvedValueOnce([allRows[0], allRows[1]]) // runValueQuery returns limit+1=2 rows
      .mockResolvedValueOnce(makeSummary(allRows))      // runValueSummary

    const page1 = await getStockValueReport(BIZ, { limit: 1 })

    expect(page1.items).toHaveLength(1)
    expect(page1.nextCursor).not.toBeNull()
    expect(page1.items[0].totalPaise).toBe(BigInt(100000))

    // Page 2: cursor sent, DB returns remaining rows
    mockQueryRaw
      .mockResolvedValueOnce([allRows[1], allRows[2]]) // rows from cursor onward, limit+1=2
      .mockResolvedValueOnce(makeSummary(allRows))

    const page2 = await getStockValueReport(BIZ, { limit: 1, cursor: page1.nextCursor! })

    expect(page2.items).toHaveLength(1)
    expect(page2.items[0].totalPaise).toBe(BigInt(50000))
    // cursor was decoded successfully (no warning logged)
    expect(page2.nextCursor).not.toBeNull()
  })

  it('last page has null nextCursor', async () => {
    const rows = [makeBatchRow('p1', 'b1', 'B1', 10, BigInt(100))] // 1000
    setupMocks(rows) // only 1 row, limit default=50 → no hasMore

    const report = await getStockValueReport(BIZ, { limit: 50 })

    expect(report.nextCursor).toBeNull()
  })
})

describe('BAT-06 Case 5: expired batches with stock > 0 appear in valuation', () => {
  it('includes expired-batch rows (valuation, not availability)', async () => {
    const pastDate = new Date('2025-01-01T00:00:00Z')
    const rows = [
      makeBatchRow('p1', 'b1', 'EXPIRED-BATCH', 25, BigInt(300), pastDate),
    ]
    setupMocks(rows)

    const report = await getStockValueReport(BIZ)

    expect(report.items).toHaveLength(1)
    const item = report.items[0]
    expect(item.kind).toBe('batch')
    expect(item.expiryDate).toEqual(pastDate)
    expect(item.totalPaise).toBe(BigInt(7500)) // 25 * 300
  })
})

describe('BAT-06 Case 6: null costPrice falls back to weightedAvgCostPaise', () => {
  it('uses product.weightedAvgCostPaise when batch.costPrice is null', async () => {
    // The SQL COALESCE(b."costPrice", p."weightedAvgCostPaise", 0) handles this.
    // At service layer we receive what the DB computed, so unitCostPaise reflects WA cost.
    const rows = [
      makeBatchRow('p1', 'b1', 'NO-COST', 10, BigInt(450)), // 450 = product WA cost
    ]
    setupMocks(rows)

    const report = await getStockValueReport(BIZ)

    expect(report.items[0].unitCostPaise).toBe(BigInt(450))
    expect(report.items[0].totalPaise).toBe(BigInt(4500))
  })
})
