/**
 * INV-04 — Stock Value Report Service Tests (updated for BAT-06)
 *
 * The service now delegates to runValueQuery / runValueSummary (raw SQL).
 * These tests mock prisma.$queryRaw directly.
 *
 * Tests:
 *   - Empty result when no rows returned
 *   - totalPaise = currentStock × unitCostPaise
 *   - Ordering is preserved from DB (service doesn't re-sort)
 *   - Cursor pagination: nextCursor set when hasMore, absent on last page
 *   - Products with unitCostPaise=0 included (value=0)
 *   - totalValuePaise equals sum from summary query
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

function makeRow(
  productId: string,
  name: string,
  currentStock: number,
  unitCostPaise: bigint,
  sku: string | null = null
) {
  return {
    kind: 'product' as const,
    productId,
    productName: name,
    sku,
    unit: 'pcs',
    batchId: null,
    batchNumber: null,
    expiryDate: null,
    currentStock,
    unitCostPaise,
    totalPaise: BigInt(Math.floor(currentStock * Number(unitCostPaise))),
  }
}

function makeSummary(rows: ReturnType<typeof makeRow>[]) {
  const total = rows.reduce((s, r) => s + r.totalPaise, BigInt(0))
  return [{ total, cnt: BigInt(rows.length) }]
}

function setupMocks(rows: ReturnType<typeof makeRow>[]) {
  mockQueryRaw
    .mockResolvedValueOnce(rows)           // runValueQuery
    .mockResolvedValueOnce(makeSummary(rows)) // runValueSummary
}

const BIZ = 'biz-1'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getStockValueReport — empty case', () => {
  it('returns empty result with zero totals when no products', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: BigInt(0), cnt: BigInt(0) }])

    const report = await getStockValueReport(BIZ)

    expect(report.items).toEqual([])
    expect(report.totalValuePaise).toBe(BigInt(0))
    expect(report.productCount).toBe(0)
    expect(report.nextCursor).toBeNull()
  })
})

describe('getStockValueReport — formula', () => {
  it('computes totalPaise = currentStock × unitCostPaise', async () => {
    const rows = [makeRow('p1', 'Rice 5kg', 10, BigInt(5000))] // 50000
    setupMocks(rows)

    const report = await getStockValueReport(BIZ)

    expect(report.items).toHaveLength(1)
    expect(report.items[0].totalPaise).toBe(BigInt(50000))
    expect(report.totalValuePaise).toBe(BigInt(50000))
  })

  it('handles product with zero cost (value = 0)', async () => {
    const rows = [makeRow('p1', 'Free Gift', 5, BigInt(0))]
    setupMocks(rows)

    const report = await getStockValueReport(BIZ)

    expect(report.items[0].totalPaise).toBe(BigInt(0))
    expect(report.totalValuePaise).toBe(BigInt(0))
  })
})

describe('getStockValueReport — ordering', () => {
  it('preserves DB-ordered results (highest totalPaise first)', async () => {
    const rows = [
      makeRow('p2', 'Expensive', 5, BigInt(5000)), // 25000
      makeRow('p3', 'Mid',       8, BigInt(500)),  // 4000
      makeRow('p1', 'Cheap',    10, BigInt(100)),  // 1000
    ]
    setupMocks(rows)

    const report = await getStockValueReport(BIZ)

    expect(report.items[0].productId).toBe('p2')
    expect(report.items[1].productId).toBe('p3')
    expect(report.items[2].productId).toBe('p1')
  })
})

describe('getStockValueReport — pagination', () => {
  it('sets nextCursor when more results exist', async () => {
    const allRows = [
      makeRow('p1', 'A', 10, BigInt(500)),
      makeRow('p2', 'B', 8, BigInt(400)),
      makeRow('p3', 'C', 6, BigInt(300)),
    ]
    // limit=2: runValueQuery returns limit+1=3 rows
    mockQueryRaw
      .mockResolvedValueOnce(allRows)
      .mockResolvedValueOnce(makeSummary(allRows))

    const report = await getStockValueReport(BIZ, { limit: 2 })

    expect(report.items).toHaveLength(2)
    expect(report.nextCursor).not.toBeNull()
  })

  it('returns null nextCursor on last page', async () => {
    const rows = [
      makeRow('p1', 'A', 10, BigInt(500)),
      makeRow('p2', 'B', 8, BigInt(400)),
    ]
    setupMocks(rows) // limit=5, only 2 rows → no hasMore

    const report = await getStockValueReport(BIZ, { limit: 5 })

    expect(report.items).toHaveLength(2)
    expect(report.nextCursor).toBeNull()
  })

  it('respects cursor to fetch next page', async () => {
    const allRows = [
      makeRow('p1', 'A', 10, BigInt(500)), // 5000
      makeRow('p2', 'B', 8, BigInt(400)),  // 3200
      makeRow('p3', 'C', 6, BigInt(300)),  // 1800
    ]

    // Page 1 (limit=1): returns 2 rows (limit+1)
    mockQueryRaw
      .mockResolvedValueOnce([allRows[0], allRows[1]])
      .mockResolvedValueOnce(makeSummary(allRows))

    const page1 = await getStockValueReport(BIZ, { limit: 1 })
    expect(page1.items[0].productId).toBe('p1')
    expect(page1.nextCursor).not.toBeNull()

    // Page 2 (limit=1): cursor sent to DB
    mockQueryRaw
      .mockResolvedValueOnce([allRows[1], allRows[2]])
      .mockResolvedValueOnce(makeSummary(allRows))

    const page2 = await getStockValueReport(BIZ, { limit: 1, cursor: page1.nextCursor! })
    expect(page2.items[0].productId).toBe('p2')
  })
})

describe('getStockValueReport — totalValuePaise', () => {
  it('sums all products from summary query (BigInt safe)', async () => {
    const bigCost = BigInt('999999999999')
    const rows = [
      makeRow('p1', 'Gold',   1000, bigCost),
      makeRow('p2', 'Silver', 500,  BigInt('100000')),
    ]
    // summary will have correct sum
    setupMocks(rows)

    const report = await getStockValueReport(BIZ)

    const expected = BigInt(1000) * bigCost + BigInt(500) * BigInt('100000')
    expect(report.totalValuePaise).toBe(expected)
  })
})
