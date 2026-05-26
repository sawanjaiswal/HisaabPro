/**
 * listDocuments — `importJobId` filter test (Phase 7 · 7.1C PR-C4).
 *
 * ARCH §13 deviation #3: invoice import lands `importJobId` on
 * Document rows so the FE can deep-link "Imported invoices" from the
 * import summary page. The 5-line where-clause addition is mechanical;
 * this test pins the contract:
 *
 *   - `?importJobId=<id>` narrows the result to that job's documents
 *   - `businessId` is ALWAYS bound first — foreign jobId returns an
 *     empty list, not someone else's data
 *   - filter omitted = legacy behaviour (no `importJobId` in where)
 *
 * Uses the global Proxy-mocked prisma (src/__tests__/setup.ts).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listDocuments } from '../get-list.js'
import { prisma } from '../../../lib/prisma.js'
import type { ListDocumentsQuery } from '../../../schemas/document.schemas.js'

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const BUSINESS_ID = 'biz-1'

function baseQuery(overrides: Partial<ListDocumentsQuery> = {}): ListDocumentsQuery {
  return {
    type: 'SALE_INVOICE',
    sortBy: 'documentDate',
    sortOrder: 'desc',
    page: 1,
    limit: 20,
    ...overrides,
  } as ListDocumentsQuery
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.document.findMany.mockResolvedValue([])
  mockPrisma.document.count.mockResolvedValue(0)
  mockPrisma.document.aggregate.mockResolvedValue({
    _sum: { grandTotal: 0, paidAmount: 0, balanceDue: 0 },
  })
})

describe('listDocuments — importJobId filter (7.1C PR-C4)', () => {
  it('applies `importJobId` to the Prisma where when present', async () => {
    await listDocuments(BUSINESS_ID, baseQuery({ importJobId: 'job-INV-abc' }))

    const call = mockPrisma.document.findMany.mock.calls[0]![0] as {
      where: { businessId: string; importJobId?: string }
    }
    expect(call.where.businessId).toBe(BUSINESS_ID)
    expect(call.where.importJobId).toBe('job-INV-abc')
  })

  it('omits `importJobId` from the where when absent (legacy listing)', async () => {
    await listDocuments(BUSINESS_ID, baseQuery())

    const call = mockPrisma.document.findMany.mock.calls[0]![0] as {
      where: Record<string, unknown>
    }
    expect(call.where.businessId).toBe(BUSINESS_ID)
    expect(call.where).not.toHaveProperty('importJobId')
  })

  it('foreign jobId still scoped by businessId (no cross-tenant leak)', async () => {
    // Even with an attacker-supplied jobId belonging to biz-2, the where
    // clause carries businessId=biz-1 — Prisma AND-composes the
    // conjunction so the SELECT returns 0 rows. This is the same shape
    // as ?partyId=<foreign> today.
    await listDocuments(BUSINESS_ID, baseQuery({ importJobId: 'job-foreign-tenant' }))

    const call = mockPrisma.document.findMany.mock.calls[0]![0] as {
      where: { businessId: string; importJobId: string }
    }
    expect(call.where.businessId).toBe(BUSINESS_ID)
    expect(call.where.importJobId).toBe('job-foreign-tenant')
  })

  it('count + aggregate inherit the same where clause (totals stay consistent)', async () => {
    await listDocuments(BUSINESS_ID, baseQuery({ importJobId: 'job-INV-xyz' }))

    const countCall = mockPrisma.document.count.mock.calls[0]![0] as {
      where: { importJobId?: string }
    }
    const aggCall = mockPrisma.document.aggregate.mock.calls[0]![0] as {
      where: { importJobId?: string }
    }
    expect(countCall.where.importJobId).toBe('job-INV-xyz')
    expect(aggCall.where.importJobId).toBe('job-INV-xyz')
  })
})
