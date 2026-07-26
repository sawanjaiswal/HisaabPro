/**
 * commit.service.ts — API.8 dedup resolutions suite.
 *
 * Covers the five contract cases for per-row decisions:
 *   1. SKIP-only over 50 STAGED + 50 DUP rows → 50 parties, 0 OVERWRITE audits.
 *   2. OVERWRITE on EXACT match → 1 party update, party fields match row,
 *      one `parties.updated_from_import` audit row.
 *   3. CREATE_NEW on NEAR match → row flips STAGED → new party created.
 *   4. Wrong decision (OVERWRITE on a non-duplicate STAGED row) → 400
 *      INVALID_RESOLUTION.
 *   5. Cross-tenant rowId (row belongs to a different job) → 404.
 */

import { describe, it, expect, vi } from 'vitest'
import { commitImportJob } from '../commit.service.js'
import { AppError, ErrorCode } from '../../../lib/errors.js'

const VALID_TOKEN = '550e8400-e29b-41d4-a716-446655440000'
const VALID_IDEMP = '11111111-2222-4333-8444-555555555555'
const AUTH_OK = { businessId: 'biz-A', userId: 'user-1' }

interface FakeRow {
  id: string
  sourceIndex: number
  status: string
  normalized: Record<string, unknown>
  matchedPartyId: string | null
  createdPartyId: string | null
  dedupAction: string | null
}

interface FakeOpts {
  rows: FakeRow[]
  /** rowIds that DO belong to the job (for tenancy check). Defaults to all. */
  ownedRowIds?: string[]
  parties?: Map<string, Record<string, unknown>>
}

// Build an in-memory Prisma double that supports the resolution path —
// queryRaw routes by SQL fragment, party.updateMany applies field patches.
function buildPrisma(opts: FakeOpts) {
  const rows = opts.rows
  const owned = new Set(opts.ownedRowIds ?? rows.map((r) => r.id))
  const parties = opts.parties ?? new Map()
  const jobRow = {
    id: 'job-1',
    businessId: 'biz-A',
    userId: 'user-1',
    status: 'PREVIEWED',
    commitToken: VALID_TOKEN,
    idempotencyKey: VALID_IDEMP,
    createdPartyIds: [],
    // 7.1B — commit-dispatcher routes by this discriminator.
    entity: 'parties',
  }

  let partyCreateCalls = 0

  const tx = {
    $executeRaw: vi.fn(async () => 1),
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...vals: unknown[]) => {
      const sql = strings.join(' ')
      // 7.1B introspection probes — short-circuit before the ImportJob branch.
      if (sql.includes('information_schema.columns')) {
        if (sql.includes("'createdEntityId'")) return [{ exists: 1 }]
        return [{ data_type: 'text' }]
      }
      if (sql.includes('pg_type') && sql.includes('pg_enum')) {
        return [{ has_label: false }]
      }
      if (sql.includes('FROM "ImportJob"')) return [jobRow]
      // Resolutions path: SELECT … FROM "ImportJobRow" WHERE jobId AND id = ANY
      if (sql.includes('FROM "ImportJobRow"') && sql.includes('= ANY')) {
        const ids = (vals[1] as string[]) ?? []
        return rows.filter((r) => ids.includes(r.id) && owned.has(r.id))
      }
      // Chunk path: SELECT … FROM "ImportJobRow" WHERE status='STAGED'
      if (sql.includes('FROM "ImportJobRow"') && sql.includes("status = 'STAGED'")) {
        return rows
          .filter((r) => r.status === 'STAGED' && !r.createdPartyId)
          .map((r) => ({
            id: r.id,
            sourceIndex: r.sourceIndex,
            normalized: r.normalized,
            matchedPartyId: r.matchedPartyId,
          }))
      }
      return []
    }),
    importJob: { update: vi.fn(async () => jobRow) },
    importJobRow: {
      updateMany: vi.fn(async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const target = rows.find((r) => r.id === a.where.id)
        if (!target) return { count: 0 }
        // Verify status constraints (mimic Prisma where filter).
        const wantStatus = a.where.status as { in?: string[] } | string | undefined
        if (wantStatus && typeof wantStatus !== 'string' && wantStatus.in && !wantStatus.in.includes(target.status)) {
          return { count: 0 }
        }
        if (typeof wantStatus === 'string' && target.status !== wantStatus) {
          return { count: 0 }
        }
        if (a.where.createdPartyId === null && target.createdPartyId !== null) {
          return { count: 0 }
        }
        const data = a.data
        if (data.status) target.status = data.status as string
        if ('matchedPartyId' in data) target.matchedPartyId = data.matchedPartyId as string | null
        if ('createdPartyId' in data) target.createdPartyId = data.createdPartyId as string | null
        if ('dedupAction' in data) target.dedupAction = data.dedupAction as string | null
        return { count: 1 }
      }),
      count: vi.fn(async () => 0),
    },
    party: {
      create: vi.fn(async (a: { data: { name: string } }) => {
        partyCreateCalls += 1
        const id = `party-new-${partyCreateCalls}`
        parties.set(id, { ...a.data })
        return { id }
      }),
      updateMany: vi.fn(async (a: { where: { id: string; businessId: string }; data: Record<string, unknown> }) => {
        const existing = parties.get(a.where.id)
        if (!existing) return { count: 0 }
        Object.assign(existing, a.data)
        return { count: 1 }
      }),
    },
    openingBalance: { create: vi.fn(async () => ({ id: 'ob' })) },
    auditLog: { create: vi.fn(async () => ({ id: 'al' })) },
  }

  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    importJobRow: { count: vi.fn(async () => 0) },
    importJob: { update: vi.fn(async () => jobRow) },
  }

  return { prisma, tx, parties }
}

function mkRow(i: number, status: string, opts: Partial<FakeRow> = {}): FakeRow {
  return {
    id: `r${i}`,
    sourceIndex: i,
    status,
    normalized: { name: `Party ${i}` },
    matchedPartyId: null,
    createdPartyId: null,
    dedupAction: null,
    ...opts,
  }
}

describe('commitImportJob — dedup resolutions (API.8)', () => {
  it('SKIP-only over 50 STAGED + 50 DUP → 50 parties, 0 overwrite audit rows', async () => {
    const rows: FakeRow[] = []
    for (let i = 0; i < 50; i++) rows.push(mkRow(i, 'STAGED'))
    for (let i = 50; i < 100; i++) {
      rows.push(mkRow(i, 'DUPLICATE_EXACT', { matchedPartyId: `existing-${i}` }))
    }
    const { prisma, tx } = buildPrisma({ rows })
    const resolutions = rows
      .filter((r) => r.status === 'DUPLICATE_EXACT')
      .map((r) => ({ rowId: r.id, decision: 'SKIP' as const }))

    const result = await commitImportJob({
      jobId: 'job-1',
      auth: AUTH_OK,
      commitToken: VALID_TOKEN,
      idempotencyKey: VALID_IDEMP,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
      dedupResolutions: resolutions,
    })

    expect(result.committedCount).toBe(50)
    expect(result.overwrittenPartyIds).toEqual([])
    expect(tx.party.create).toHaveBeenCalledTimes(50)
    expect(tx.party.updateMany).not.toHaveBeenCalled()
    const events = (tx.auditLog.create.mock.calls as unknown as Array<
      [{ data: { changes: { event: string } } }]
    >).map((c) => c[0].data.changes.event)
    expect(events).not.toContain('parties.updated_from_import')
  })

  it('OVERWRITE on EXACT match updates party fields and emits one batched audit', async () => {
    const parties = new Map<string, Record<string, unknown>>([
      ['party-99', { name: 'Old Name', phone: '0000000000' }],
    ])
    const rows: FakeRow[] = [
      mkRow(1, 'DUPLICATE_EXACT', {
        matchedPartyId: 'party-99',
        normalized: { name: 'Raju Traders', phone: '9999999999' },
      }),
    ]
    const { prisma, tx, parties: result } = buildPrisma({ rows, parties })

    const r = await commitImportJob({
      jobId: 'job-1',
      auth: AUTH_OK,
      commitToken: VALID_TOKEN,
      idempotencyKey: VALID_IDEMP,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
      dedupResolutions: [{ rowId: 'r1', decision: 'OVERWRITE' }],
    })

    expect(r.overwrittenPartyIds).toEqual(['party-99'])
    expect(result.get('party-99')).toMatchObject({
      name: 'Raju Traders',
      phone: '9999999999',
    })
    const updateAudits = (tx.auditLog.create.mock.calls as unknown as Array<
      [{ data: { changes: { event: string; partyIds?: string[] } } }]
    >).filter((c) => c[0].data.changes.event === 'parties.updated_from_import')
    expect(updateAudits).toHaveLength(1)
    expect(updateAudits[0]![0].data.changes.partyIds).toEqual(['party-99'])
    expect(rows[0]!.status).toBe('COMMITTED')
    expect(rows[0]!.createdPartyId).toBe('party-99')
  })

  it('CREATE_NEW on NEAR match flips row → STAGED and creates a new party', async () => {
    const rows: FakeRow[] = [
      mkRow(1, 'DUPLICATE_NEAR', {
        matchedPartyId: 'party-77',
        normalized: { name: 'Raju (new)' },
      }),
    ]
    const { prisma, tx } = buildPrisma({ rows })

    const result = await commitImportJob({
      jobId: 'job-1',
      auth: AUTH_OK,
      commitToken: VALID_TOKEN,
      idempotencyKey: VALID_IDEMP,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
      dedupResolutions: [{ rowId: 'r1', decision: 'CREATE_NEW' }],
    })

    expect(result.committedCount).toBe(1)
    expect(result.overwrittenPartyIds).toEqual([])
    expect(tx.party.create).toHaveBeenCalledTimes(1)
    // Row was flipped STAGED then committed by the chunk loop.
    expect(rows[0]!.status).toBe('COMMITTED')
    expect(rows[0]!.matchedPartyId).toBe(null)
  })

  it('OVERWRITE on a non-duplicate STAGED row → 400 INVALID_RESOLUTION', async () => {
    const rows: FakeRow[] = [mkRow(1, 'STAGED', { matchedPartyId: 'party-9' })]
    const { prisma } = buildPrisma({ rows })

    await expect(
      commitImportJob({
        jobId: 'job-1',
        auth: AUTH_OK,
        commitToken: VALID_TOKEN,
        idempotencyKey: VALID_IDEMP,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma: prisma as any,
        dedupResolutions: [{ rowId: 'r1', decision: 'OVERWRITE' }],
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.INVALID_RESOLUTION,
      statusCode: 400,
    })
  })

  it('cross-tenant rowId (not in job) → 404 NOT_FOUND', async () => {
    const rows: FakeRow[] = [
      mkRow(1, 'DUPLICATE_EXACT', { matchedPartyId: 'party-1' }),
    ]
    // ownedRowIds is empty → the row exists in the table but NOT under this job.
    const { prisma } = buildPrisma({ rows, ownedRowIds: [] })

    await expect(
      commitImportJob({
        jobId: 'job-1',
        auth: AUTH_OK,
        commitToken: VALID_TOKEN,
        idempotencyKey: VALID_IDEMP,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma: prisma as any,
        dedupResolutions: [{ rowId: 'r1', decision: 'SKIP' }],
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
      statusCode: 404,
    })
  })

  it('AppError from resolutions is NOT converted to PARTIALLY_COMMITTED', async () => {
    const rows: FakeRow[] = [mkRow(1, 'STAGED')]
    const { prisma } = buildPrisma({ rows })
    try {
      await commitImportJob({
        jobId: 'job-1',
        auth: AUTH_OK,
        commitToken: VALID_TOKEN,
        idempotencyKey: VALID_IDEMP,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma: prisma as any,
        dedupResolutions: [{ rowId: 'r1', decision: 'OVERWRITE' }],
      })
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
    }
    expect(prisma.importJob.update).not.toHaveBeenCalled()
  })
})
