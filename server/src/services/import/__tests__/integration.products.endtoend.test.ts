/**
 * Phase 7 · 7.1B (API.B4) — Products end-to-end integration test.
 *
 * Drives a 100-row generic-CSV product buffer through `runParseAndStage`
 * with `entity: 'product'` and asserts:
 *   - status transitions UPLOADED → PARSING → PREVIEWED
 *   - rowCount/errorCount split correctly (1 missing-name → ERROR)
 *   - commitToken minted (≥20 chars, S11)
 *   - dedup queries strictly scoped by businessId (cross-tenant safety)
 *   - JSONB `normalized` payload is M5-serialised (BigInt → string)
 *   - bulk insert chunks within ROW_INSERT_CHUNK (single createMany for 100)
 *
 * Mocks the prisma client structurally so the test runs without a live DB.
 */

import { describe, it, expect, vi } from 'vitest'
import { runParseAndStage } from '../parse.service.js'

function build100RowProductCsv(): Buffer {
  const header = 'name,sku,hsn,unit,salePrice,purchasePrice,mrp,openingStock'
  const rows: string[] = []
  for (let i = 0; i < 100; i += 1) {
    if (i === 42) {
      // sourceIndex 42 — empty name → NAME_REQUIRED → ERROR.
      rows.push(`,SKU-${i},96081019,pcs,7.00,5.00,10.00,${i}`)
    } else {
      rows.push(`Product ${i},SKU-${i},96081019,pcs,7.00,5.00,10.00,${i}`)
    }
  }
  return Buffer.from([header, ...rows].join('\n'))
}

interface JobUpdate {
  data: Record<string, unknown>
}
interface CreateManyCall {
  data: Array<{
    sourceIndex: number
    status: string
    raw: Record<string, unknown>
    normalized: Record<string, unknown>
    issues: unknown
  }>
}

function buildPrisma() {
  const updates: JobUpdate[] = []
  const auditCreates: Array<{ data: Record<string, unknown> }> = []
  const createManyCalls: CreateManyCall[] = []
  const queryRawCalls: unknown[][] = []
  const productFindManyCalls: Array<{ where: Record<string, unknown> }> = []

  const importJob = {
    update: vi.fn(async (args: JobUpdate) => {
      updates.push(args)
      return { id: 'job-1' }
    }),
  }
  const auditLog = {
    create: vi.fn(async (args: { data: Record<string, unknown> }) => {
      auditCreates.push(args)
      return { id: 'al' }
    }),
  }
  const tx = { importJob, auditLog }

  const prisma = {
    importJob,
    importJobRow: {
      createMany: vi.fn(async (args: CreateManyCall) => {
        createManyCalls.push(args)
        return { count: args.data.length }
      }),
    },
    product: {
      findMany: vi.fn(async (args: { where: Record<string, unknown> }) => {
        productFindManyCalls.push(args)
        return []
      }),
    },
    $queryRaw: vi.fn(async (...callArgs: unknown[]) => {
      queryRawCalls.push(callArgs)
      return []
    }),
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  }
  return {
    prisma,
    updates,
    createManyCalls,
    queryRawCalls,
    productFindManyCalls,
    auditCreates,
  }
}

const PRODUCT_MAPPING = {
  name: 'name',
  sku: 'sku',
  hsn: 'hsn',
  unit: 'unit',
  salePrice: 'salePrice',
  purchasePrice: 'purchasePrice',
  mrp: 'mrp',
  openingStock: 'openingStock',
}

describe('Phase 7 · 7.1B API.B4 — products end-to-end', () => {
  it('100-row CSV: 99 STAGED + 1 ERROR; PREVIEWED with commitToken (S11)', async () => {
    const { prisma, updates, createManyCalls } = buildPrisma()
    const result = await runParseAndStage({
      jobId: 'job-1',
      buffer: build100RowProductCsv(),
      format: 'GENERIC_CSV',
      entity: 'product',
      productMapping: PRODUCT_MAPPING,
      auth: { businessId: 'biz-A', userId: 'user-1' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })

    expect(result.rowCount).toBe(100)
    expect(result.errorCount).toBe(1)
    expect(result.commitToken).toMatch(/^[0-9a-f-]{30,40}$/i)
    expect(result.commitToken.length).toBeGreaterThanOrEqual(20)

    const statuses = updates.map((u) => u.data.status)
    expect(statuses).toEqual(['PARSING', 'PREVIEWED'])

    // 100 rows fit a single chunk (ROW_INSERT_CHUNK = 500).
    expect(createManyCalls).toHaveLength(1)
    expect(createManyCalls[0]!.data).toHaveLength(100)
  })

  it('staged rows have M5-serialised normalized payload (BigInt → string)', async () => {
    const { prisma, createManyCalls } = buildPrisma()
    await runParseAndStage({
      jobId: 'job-1',
      buffer: build100RowProductCsv(),
      format: 'GENERIC_CSV',
      entity: 'product',
      productMapping: PRODUCT_MAPPING,
      auth: { businessId: 'biz-A', userId: 'user-1' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    const firstStaged = createManyCalls[0]!.data.find(
      (r) => r.status === 'STAGED',
    )!
    // BigInt salePrice survived JSONB shuttle as a string of digits, not
    // a {} object. Guards against `JSON.stringify(BigInt)` runtime throw.
    expect(typeof firstStaged.normalized.salePrice).toBe('string')
    expect(firstStaged.normalized.salePrice).toMatch(/^\d+$/)
  })

  it('cross-tenant safety — businessId is bound in both dedup queries', async () => {
    const { prisma, productFindManyCalls, queryRawCalls } = buildPrisma()
    const businessId = 'biz-tenant-X'
    await runParseAndStage({
      jobId: 'job-1',
      buffer: build100RowProductCsv(),
      format: 'GENERIC_CSV',
      entity: 'product',
      productMapping: PRODUCT_MAPPING,
      auth: { businessId, userId: 'user-1' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })

    // exactSkuMatch — businessId in findMany.where.
    expect(productFindManyCalls.length).toBeGreaterThan(0)
    expect(productFindManyCalls[0]!.where.businessId).toBe(businessId)

    // trgmNameMatch — businessId in $queryRaw bound values (NOT interpolated
    // into the template). At least one call binds the tenant id.
    expect(queryRawCalls.length).toBeGreaterThan(0)
    const anyBound = queryRawCalls.some((call) => call.slice(1).includes(businessId))
    expect(anyBound).toBe(true)
  })

  it('dispatches per-entity — entity=parties does NOT call product.findMany', async () => {
    const { prisma, productFindManyCalls } = buildPrisma()
    // A tiny parties CSV so the parties branch can succeed.
    const partiesCsv = Buffer.from(
      ['name,phone', 'Raju Traders,9111111111'].join('\n'),
    )
    // partiesCsv path requires a party mapping override; supply one.
    await runParseAndStage({
      jobId: 'job-1',
      buffer: partiesCsv,
      format: 'GENERIC_CSV',
      entity: 'parties',
      mapping: { name: 'name', phone: 'phone' },
      auth: { businessId: 'biz-A', userId: 'user-1' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: {
        ...prisma,
        party: { findMany: vi.fn(async () => []) },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    })
    expect(productFindManyCalls).toHaveLength(0)
  })
})
