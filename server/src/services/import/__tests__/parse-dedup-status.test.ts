/**
 * A row's status is what the commit acts on — so every judgement about the row
 * has to land there.
 *
 * The commit's STAGED pass creates a party unconditionally; `DUPLICATE_*` rows
 * are excluded from it and wait for the shopkeeper's decision. A row that
 * matches a customer the shop already has, but is staged STAGED anyway, is
 * therefore created a second time — and Postgres' (businessId, phone) unique
 * index aborts the ENTIRE commit transaction, losing every other row in the
 * file with it.
 *
 * The same crash arrives from inside one file: exports repeat a phone number
 * constantly (a shop and its owner, a customer entered twice), and a
 * database-only dedup cannot see that.
 */

import { describe, it, expect, vi } from 'vitest'
import { runParseAndStage } from '../parse.service.js'

interface StagedRowShape {
  sourceIndex: number
  status: string
  matchedPartyId: string | null
  issues: Array<{ code: string }>
}

function buildPrisma(
  existingParties: Array<{
    id: string
    name: string
    phone: string | null
    gstin: string | null
  }> = [],
) {
  const createManyCalls: Array<{ data: unknown[] }> = []
  const tx = {
    importJob: { update: vi.fn(async () => ({ id: 'job-1' })) },
    auditLog: { create: vi.fn(async () => ({ id: 'al' })) },
  }
  const prisma = {
    importJob: { update: vi.fn(async () => ({ id: 'job-1' })) },
    importJobRow: {
      createMany: vi.fn(async (args: { data: unknown[] }) => {
        createManyCalls.push(args)
        return { count: args.data.length }
      }),
    },
    party: { findMany: vi.fn(async () => existingParties) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  }
  return { prisma, createManyCalls }
}

const MAPPING = { name: 'name', phone: 'phone', gstin: 'gstin' }
const auth = { businessId: 'biz-A', userId: 'user-1' }

async function stage(csv: string, existing: Parameters<typeof buildPrisma>[0] = []) {
  const { prisma, createManyCalls } = buildPrisma(existing)
  await runParseAndStage({
    jobId: 'job-1',
    buffer: Buffer.from(csv, 'utf8'),
    format: 'GENERIC_CSV',
    mapping: MAPPING,
    auth,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma: prisma as any,
  })
  return createManyCalls[0]!.data as StagedRowShape[]
}

describe('a duplicate is staged as a duplicate, not as a new party', () => {
  it('a row matching an existing party by phone is DUPLICATE_EXACT', async () => {
    const rows = await stage(
      ['name,phone,gstin', 'Raju Traders,9111111111,', 'Priya Wholesale,9222222222,'].join('\n'),
      [{ id: 'party-existing', name: 'Old Raju', phone: '9111111111', gstin: null }],
    )
    expect(rows[0]!.status).toBe('DUPLICATE_EXACT')
    expect(rows[0]!.matchedPartyId).toBe('party-existing')
    // The row that matches nothing is unaffected.
    expect(rows[1]!.status).toBe('STAGED')
  })

  it('a row matching an existing party by GSTIN is DUPLICATE_EXACT', async () => {
    const rows = await stage(
      ['name,phone,gstin', 'Raju Traders,9111111111,27AAPFU0939F1ZV'].join('\n'),
      [{ id: 'party-gst', name: 'Old Raju', phone: null, gstin: '27AAPFU0939F1ZV' }],
    )
    expect(rows[0]!.status).toBe('DUPLICATE_EXACT')
    expect(rows[0]!.matchedPartyId).toBe('party-gst')
  })

  it('a phone repeated inside one file marks the later row, not the first', async () => {
    const rows = await stage(
      [
        'name,phone,gstin',
        'Raju Traders,9111111111,',
        'Raju Traders Shop,9111111111,',
        'Priya Wholesale,9222222222,',
      ].join('\n'),
    )
    expect(rows[0]!.status, 'the first occurrence is the one that gets created').toBe('STAGED')
    expect(rows[1]!.status).toBe('DUPLICATE_EXACT')
    expect(rows[1]!.issues.map((i) => i.code)).toContain('DUPLICATE_IN_FILE')
    expect(rows[2]!.status).toBe('STAGED')
  })

  it('a near match stays committable and only carries a warning', async () => {
    const rows = await stage(
      ['name,phone,gstin', 'Raju Traders,9111111111,'].join('\n'),
      [{ id: 'party-near', name: 'Raju Trader', phone: '9999999999', gstin: null }],
    )
    expect(rows[0]!.status, 'a fuzzy name match must not silently drop a customer').toBe('STAGED')
    expect(rows[0]!.issues.map((i) => i.code)).toContain('NEAR_DUPLICATE')
  })

  it('a row with no name is still an ERROR even when it duplicates', async () => {
    const rows = await stage(
      ['name,phone,gstin', ',9111111111,'].join('\n'),
      [{ id: 'party-existing', name: 'Old Raju', phone: '9111111111', gstin: null }],
    )
    expect(rows[0]!.status).toBe('ERROR')
  })
})
