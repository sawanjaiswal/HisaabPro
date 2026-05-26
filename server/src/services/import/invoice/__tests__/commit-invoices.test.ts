/**
 * Phase 7 · 7.1C PR-C3 — commit-invoices.service unit tests.
 *
 * Mocked tx → no real Postgres. Asserts:
 *   - happy 3-row chunk: 3 Documents + 1 batched audit row + ChunkResult shape
 *   - P2003 on createMany → PRODUCT_DELETED_DURING_COMMIT (S8)
 *   - blocked product (still NOT_FOUND post re-resolve) → COMMIT_BLOCKED_PRODUCT_NOT_FOUND
 *   - createdPartyIds carries Document IDs (precedent: 7.1B)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError, ErrorCode } from '../../../../lib/errors.js'

const { createPartyTxMock } = vi.hoisted(() => ({
  createPartyTxMock: vi.fn(async () => ({ id: 'fly-party-id' })),
}))
vi.mock('../../../party/create-tx.js', () => ({
  createPartyTx: createPartyTxMock,
}))

import { commitChunkInvoices } from '../../commit-invoices.service.js'

interface Line {
  source: { sku: string | null; productNameRaw: string | null }
  resolved: { productId: string | null; matchedBy: string }
  qty: number
  ratePaise: number | null
  taxableValuePaise: number | null
  cgstPaise: number | null
  sgstPaise: number | null
  igstPaise: number | null
  lineTotalPaise: number | null
}

function mkLine(productId: string | null, matchedBy = productId ? 'BY_SKU' : 'NOT_FOUND'): Line {
  return {
    source: { sku: 'SKU-' + (productId ?? 'X'), productNameRaw: 'Widget' },
    resolved: { productId, matchedBy },
    qty: 1, ratePaise: 10000, taxableValuePaise: 10000,
    cgstPaise: 900, sgstPaise: 900, igstPaise: 0, lineTotalPaise: 11800,
  }
}

function mkRow(id: string, sourceIndex: number, lines: Line[], partyName = 'Raju') {
  return {
    id,
    sourceIndex,
    normalized: {
      documentNumber: 'INV-' + sourceIndex,
      documentDate: '2025-03-15',
      party: { source: { name: partyName, phone: '9999999990' } },
      lines,
      subtotalPaise: 10000,
      totalCgstPaise: 900,
      totalSgstPaise: 900,
      totalIgstPaise: 0,
      grandTotalPaise: 11800,
      notes: null,
    },
  }
}

interface BuildOpts {
  rows: ReturnType<typeof mkRow>[]
  partySnapshot?: Array<{ id: string; nameLower: string; phone: string }>
  productSnapshot?: Array<{ id: string; sku: string; nameLower: string }>
  failCreateManyWithP2003?: boolean
}

function buildTx(opts: BuildOpts) {
  let docCounter = 0
  const createMany = vi.fn(async () => {
    if (opts.failCreateManyWithP2003) {
      const err = new Error('P2003: FK violation') as Error & { code: string }
      err.code = 'P2003'
      throw err
    }
    return { count: 1 }
  })
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join(' ')
      if (sql.includes('FROM "ImportJobRow"')) return opts.rows
      if (sql.includes('FROM "Party"')) return opts.partySnapshot ?? []
      if (sql.includes('FROM "Product"')) return opts.productSnapshot ?? []
      return []
    }),
    document: {
      create: vi.fn(async () => {
        docCounter += 1
        return {
          id: 'doc-' + docCounter,
          documentNumber: 'INV-' + docCounter,
          grandTotal: 11800,
        }
      }),
    },
    documentLineItem: { createMany },
    importJobRow: { updateMany: vi.fn(async () => ({ count: 1 })) },
    party: { findFirst: vi.fn(async () => null) },
    auditLog: { create: vi.fn(async () => ({ id: 'al' })) },
  }
  return tx
}

beforeEach(() => {
  createPartyTxMock.mockReset()
  createPartyTxMock.mockResolvedValue({ id: 'fly-party-id' })
})

describe('commitChunkInvoices', () => {
  const args = { jobId: 'job1', businessId: 'biz', userId: 'u1' }

  it('happy path — 3 rows → 3 Documents + 1 batched audit row', async () => {
    const rows = [
      mkRow('r1', 0, [mkLine('p1')]),
      mkRow('r2', 1, [mkLine('p1'), mkLine('p2')]),
      mkRow('r3', 2, [mkLine('p2')]),
    ]
    const tx = buildTx({
      rows,
      partySnapshot: [{ id: 'existing-party', nameLower: 'raju', phone: '9999999990' }],
      productSnapshot: [
        { id: 'p1', sku: 'SKU-p1', nameLower: 'widget' },
        { id: 'p2', sku: 'SKU-p2', nameLower: 'widget' },
      ],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await commitChunkInvoices(tx as any, args)
    expect(result.createdPartyIds).toHaveLength(3) // documentIds
    expect(result.createdPartyIds[0]).toBe('doc-1')
    expect(result.sourceIndices).toEqual([0, 1, 2])
    expect(result.done).toBe(true)
    expect(tx.document.create).toHaveBeenCalledTimes(3)
    expect(tx.documentLineItem.createMany).toHaveBeenCalledTimes(3)
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1)
    const auditCall = (tx.auditLog.create.mock.calls[0] as unknown as [
      { data: { changes: { event: string; documentIds: string[]; count: number } } },
    ])[0]
    expect(auditCall.data.changes.event).toBe('invoices.imported_batch')
    expect(auditCall.data.changes.documentIds).toHaveLength(3)
    expect(auditCall.data.changes.count).toBe(3)
  })

  it('P2003 on createMany → PRODUCT_DELETED_DURING_COMMIT (S8)', async () => {
    const rows = [mkRow('r1', 0, [mkLine('p1')])]
    const tx = buildTx({
      rows,
      partySnapshot: [{ id: 'existing', nameLower: 'raju', phone: '9999999990' }],
      productSnapshot: [{ id: 'p1', sku: 'SKU-p1', nameLower: 'widget' }],
      failCreateManyWithP2003: true,
    })
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await commitChunkInvoices(tx as any, args)
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).code).toBe(ErrorCode.PRODUCT_DELETED_DURING_COMMIT)
    }
  })

  it('stale + still-missing → COMMIT_BLOCKED_PRODUCT_NOT_FOUND with sample', async () => {
    const rows = [mkRow('r1', 0, [mkLine(null, 'NOT_FOUND')])]
    const tx = buildTx({
      rows,
      partySnapshot: [{ id: 'existing', nameLower: 'raju', phone: '9999999990' }],
      productSnapshot: [], // still missing post-re-resolve
    })
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await commitChunkInvoices(tx as any, args)
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      const err = e as AppError
      expect(err.code).toBe(ErrorCode.COMMIT_BLOCKED_PRODUCT_NOT_FOUND)
      expect(err.statusCode).toBe(409)
      expect(err.details?.blockedRowCount).toBe(1)
      expect(err.details?.missingSkuSample).toBeInstanceOf(Array)
    }
    expect(tx.document.create).not.toHaveBeenCalled()
  })

  it('stale → fresh snapshot re-resolves NOT_FOUND, then commits cleanly', async () => {
    const rows = [mkRow('r1', 0, [mkLine(null, 'NOT_FOUND')])]
    const tx = buildTx({
      rows,
      partySnapshot: [{ id: 'existing', nameLower: 'raju', phone: '9999999990' }],
      // Fresh snapshot has the product — the mkLine source.sku is 'SKU-X'
      productSnapshot: [{ id: 'p-new', sku: 'SKU-X', nameLower: 'widget' }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await commitChunkInvoices(tx as any, args)
    expect(result.createdPartyIds).toHaveLength(1)
    expect(tx.document.create).toHaveBeenCalledTimes(1)
  })

  it('empty chunk returns done=true with no audit row', async () => {
    const tx = buildTx({ rows: [] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await commitChunkInvoices(tx as any, args)
    expect(result).toEqual({ createdPartyIds: [], sourceIndices: [], done: true })
    expect(tx.auditLog.create).not.toHaveBeenCalled()
  })
})
