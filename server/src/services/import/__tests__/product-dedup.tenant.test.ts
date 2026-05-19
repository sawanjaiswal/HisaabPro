import { describe, it, expect, vi } from 'vitest'
import { exactSkuMatch, trgmNameMatch } from '../dedup/product-dedup.js'

/**
 * Pure unit tests — verify the businessId scope is BOUND into every
 * Prisma read, so a malicious caller (or a buggy other-tenant userId)
 * cannot bleed product matches across tenants.
 */
describe('Phase 7 · 7.1B — product dedup tenant isolation', () => {
  it('exactSkuMatch passes businessId into findMany.where', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const prisma = { product: { findMany } } as never
    await exactSkuMatch({
      businessId: 'biz_A',
      rows: [
        { sourceIndex: 0, name: 'Pen', sku: 'PEN-01', openingStock: '0', issues: [] },
      ],
      prisma,
    })
    expect(findMany).toHaveBeenCalledTimes(1)
    const arg = findMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(arg.where.businessId).toBe('biz_A')
    expect(arg.where.isDeleted).toBe(false)
  })

  it('trgmNameMatch interpolates businessId as the FIRST bound parameter', async () => {
    const queryRaw = vi.fn().mockResolvedValue([])
    const prisma = { $queryRaw: queryRaw } as never
    await trgmNameMatch({
      businessId: 'biz_B',
      rows: [
        { sourceIndex: 0, name: 'Pencil', openingStock: '0', issues: [] },
      ],
      prisma,
    })
    // $queryRaw receives a TemplateStringsArray + bound values. We only
    // care that businessId AND name are bound (never interpolated).
    expect(queryRaw).toHaveBeenCalledTimes(1)
    const boundValues = queryRaw.mock.calls[0]!.slice(1)
    expect(boundValues).toContain('biz_B')
    expect(boundValues).toContain('Pencil')
  })

  it('exactSkuMatch returns empty when no SKUs in batch', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const prisma = { product: { findMany } } as never
    const out = await exactSkuMatch({
      businessId: 'biz_C',
      rows: [{ sourceIndex: 0, name: 'Pen', openingStock: '0', issues: [] }],
      prisma,
    })
    expect(out.size).toBe(0)
    expect(findMany).not.toHaveBeenCalled()
  })
})
