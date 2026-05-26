/**
 * Shared Prisma test-double for commit.service tests. Extracted so the
 * happy-path and the M3-binding suites can stay ≤250 LOC each.
 *
 * `$transaction(fn)` runs `fn(tx)` synchronously with a single in-memory
 * tx object. `$queryRaw` routes by SQL fragment to either the locked job
 * row or the chunk-fetch result.
 */

import { vi } from 'vitest'

export const VALID_TOKEN = '550e8400-e29b-41d4-a716-446655440000'
export const VALID_IDEMP = '11111111-2222-4333-8444-555555555555'

export interface BuildOpts {
  jobOverrides?: Record<string, unknown>
  stagedRows?: Array<{
    id: string
    sourceIndex: number
    normalized: Record<string, unknown>
    matchedPartyId: string | null
  }>
  failPartyCreateAt?: number
}

export function buildPrisma(opts: BuildOpts = {}) {
  const stagedRows = opts.stagedRows ?? [
    {
      id: 'r1',
      sourceIndex: 0,
      normalized: { name: 'Raju' },
      matchedPartyId: null,
    },
  ]
  const jobRow = {
    id: 'job-1',
    businessId: 'biz-A',
    userId: 'user-1',
    status: 'PREVIEWED',
    commitToken: VALID_TOKEN,
    idempotencyKey: VALID_IDEMP,
    createdPartyIds: [],
    // 7.1B — commit-dispatcher routes by this discriminator.
    entity: 'parties' as 'parties' | 'product',
    ...opts.jobOverrides,
  }

  let chunkCalls = 0
  let partyCreateCalls = 0

  const tx = {
    $executeRaw: vi.fn(async () => 1),
    $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join(' ')
      // 7.1B — schema introspection probes hit information_schema /
      // pg_type; resolve them first so they don't get misrouted to the
      // staged-rows branch below.
      if (sql.includes('information_schema.columns')) {
        if (sql.includes("'createdEntityId'")) return [{ exists: 1 }]
        return [{ data_type: 'text' }]
      }
      if (sql.includes('pg_type') && sql.includes('pg_enum')) {
        return [{ has_label: false }]
      }
      if (sql.includes('FROM "ImportJob"')) return [jobRow]
      if (sql.includes('FROM "ImportJobRow"')) {
        chunkCalls += 1
        if (chunkCalls === 1) return stagedRows
        return []
      }
      return []
    }),
    importJob: { update: vi.fn(async () => jobRow) },
    importJobRow: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      count: vi.fn(async () => 0),
    },
    party: {
      create: vi.fn(async () => {
        partyCreateCalls += 1
        if (opts.failPartyCreateAt === partyCreateCalls) {
          throw new Error('simulated party.create failure')
        }
        return { id: `party-${partyCreateCalls}` }
      }),
    },
    openingBalance: { create: vi.fn(async () => ({ id: 'ob' })) },
    auditLog: { create: vi.fn(async () => ({ id: 'al' })) },
  }

  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
    importJobRow: { count: vi.fn(async () => 0) },
    importJob: { update: vi.fn(async () => jobRow) },
  }

  return { prisma, tx }
}

export const AUTH_OK = { businessId: 'biz-A', userId: 'user-1' }
