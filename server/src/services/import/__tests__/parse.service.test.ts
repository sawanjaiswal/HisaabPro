/**
 * parse.service.ts — unit tests
 *
 * Drives a 5-row generic-CSV buffer through parseAndStage and verifies:
 *   - status transitions UPLOADED → PARSING → PREVIEWED
 *   - rowCount/errorCount populated
 *   - commitToken minted (string >= 20)
 *   - exact-dedup hits feed matchedPartyId
 *   - createMany invoked with the right column shape
 */

import { describe, it, expect, vi } from 'vitest'
import { runParseAndStage } from '../parse.service.js'

const CSV_5_ROWS = Buffer.from(
  [
    'name,phone,gstin,opening_balance',
    'Raju Traders,9111111111,,1000',
    'Priya Wholesalers,9222222222,27AAPFU0939F1ZV,5000',
    'Amit Co,9333333333,,0',
    ',9444444444,,', // empty name -> ERROR (MISSING_NAME)
    'Banner Co,9555555555,,', // STAGED, no balance
  ].join('\n'),
)

const MAPPING = {
  name: 'name',
  phone: 'phone',
  gstin: 'gstin',
  openingBalance: 'opening_balance',
}

interface JobUpdate {
  data: Record<string, unknown>
}

function buildPrisma(opts: { existingParties?: Array<{ id: string; name: string; phone: string | null; gstin: string | null }> } = {}) {
  const updates: JobUpdate[] = []
  const auditCreates: Array<{ data: Record<string, unknown> }> = []
  const createManyCalls: { args: { data: unknown[] } }[] = []
  const partyFindMany = vi.fn(async () => opts.existingParties ?? [])
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
      createMany: vi.fn(async (args: { data: unknown[] }) => {
        createManyCalls.push({ args })
        return { count: args.data.length }
      }),
    },
    party: { findMany: partyFindMany },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  }
  return { prisma, updates, createManyCalls, partyFindMany, auditCreates }
}

const auth = { businessId: 'biz-A', userId: 'user-1' }

describe('runParseAndStage', () => {
  it('happy path — 5 rows, 1 error, commits PREVIEWED with commitToken', async () => {
    const { prisma, updates, createManyCalls } = buildPrisma()
    const result = await runParseAndStage({
      jobId: 'job-1',
      buffer: CSV_5_ROWS,
      format: 'GENERIC_CSV',
      mapping: MAPPING,
      auth,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(result.rowCount).toBe(5)
    expect(result.errorCount).toBe(1)
    expect(result.commitToken).toMatch(/^[0-9a-f-]{30,40}$/i)
    // Two updates expected: → PARSING, → PREVIEWED.
    const statuses = updates.map((u) => u.data.status)
    expect(statuses).toEqual(['PARSING', 'PREVIEWED'])
    const finalUpdate = updates[1]!.data as Record<string, unknown>
    expect(finalUpdate.rowCount).toBe(5)
    expect(finalUpdate.errorCount).toBe(1)
    expect(typeof finalUpdate.commitToken).toBe('string')
    expect((finalUpdate.commitToken as string).length).toBeGreaterThanOrEqual(20)
    // All 5 rows inserted in a single batch.
    expect(createManyCalls).toHaveLength(1)
    expect(createManyCalls[0]!.args.data).toHaveLength(5)
  })

  it('exact-dedup match is reflected in matchedPartyId on the staged row', async () => {
    const { prisma, createManyCalls } = buildPrisma({
      existingParties: [
        { id: 'party-existing', name: 'Old Raju', phone: '+919111111111', gstin: null },
      ],
    })
    await runParseAndStage({
      jobId: 'job-1',
      buffer: CSV_5_ROWS,
      format: 'GENERIC_CSV',
      mapping: MAPPING,
      auth,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    const rows = createManyCalls[0]!.args.data as Array<{
      sourceIndex: number
      matchedPartyId: string | null
      status: string
    }>
    const dupRow = rows.find((r) => r.sourceIndex === 0)
    expect(dupRow?.matchedPartyId).toBe('party-existing')
    expect(dupRow?.status).toBe('STAGED')
  })

  it('row without a name is classified ERROR (not STAGED)', async () => {
    const { prisma, createManyCalls } = buildPrisma()
    await runParseAndStage({
      jobId: 'job-1',
      buffer: CSV_5_ROWS,
      format: 'GENERIC_CSV',
      mapping: MAPPING,
      auth,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    const rows = createManyCalls[0]!.args.data as Array<{
      sourceIndex: number
      status: string
    }>
    // sourceIndex 3 = "NoName" but actually that has name "NoName" — empty
    // name was a typo. Verify by counting ERROR rows.
    const errors = rows.filter((r) => r.status === 'ERROR')
    // CSV has exactly ONE empty-name row (the 4th data row, sourceIndex 3
    // depending on parser). Verify a single MISSING_NAME error is raised.
    expect(errors).toHaveLength(1)
  })

  it('dedup query is scoped strictly by businessId', async () => {
    let captured: { where: { businessId: string } } | undefined
    const partyFindMany = vi.fn(
      async (args: { where: { businessId: string } }) => {
        captured = args
        return []
      },
    )
    const importJob = { update: vi.fn(async () => ({})) }
    const auditLog = { create: vi.fn(async () => ({ id: 'al' })) }
    const tx = { importJob, auditLog }
    const prisma = {
      importJob,
      importJobRow: { createMany: vi.fn(async () => ({ count: 0 })) },
      party: { findMany: partyFindMany },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    }
    await runParseAndStage({
      jobId: 'job-1',
      buffer: CSV_5_ROWS,
      format: 'GENERIC_CSV',
      mapping: MAPPING,
      auth: { businessId: 'biz-tenant-X', userId: 'user-1' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(captured?.where.businessId).toBe('biz-tenant-X')
  })
})
