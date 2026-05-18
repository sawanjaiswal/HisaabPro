/**
 * import-retention.cron.ts — unit tests
 *
 * Three passes:
 *   1. COMMITTED >24h ago → raw + normalized NULLed on every row.
 *   2. PARSING >5min ago → status FAILED + import_job.parse_timeout audit.
 *   3. expiresAt past + non-terminal → EXPIRED + raw NULLed + audit.
 *
 * No real Prisma — hand-rolled in-memory store mirrors $executeRaw +
 * findMany + updateMany surface used by the cron.
 */

import { describe, it, expect, vi } from 'vitest'
import { runImportRetentionCron } from '../import-retention.cron.js'

interface JobRow {
  id: string
  businessId: string
  userId: string
  status: string
  committedAt?: Date | null
  updatedAt: Date
  expiresAt: Date
}

interface JobRowRow {
  id: string
  jobId: string
  raw: object | null
  normalized: object | null
}

interface Store {
  jobs: JobRow[]
  rows: JobRowRow[]
  audits: Array<{ data: Record<string, unknown> }>
}

function buildPrisma(store: Store) {
  const matchSQL = (parts: TemplateStringsArray) => parts.join(' ').replace(/\s+/g, ' ')

  const tx = {
    importJob: {
      updateMany: vi.fn(async (args: { where: { id: string; status?: { notIn?: string[] }; expiresAt?: { lt: Date } }; data: { status: string; counts?: object } }) => {
        const job = store.jobs.find((j) => j.id === args.where.id)
        if (!job) return { count: 0 }
        if (args.where.status && typeof args.where.status === 'object' && 'notIn' in args.where.status && args.where.status.notIn!.includes(job.status)) return { count: 0 }
        if (args.where.expiresAt && job.expiresAt >= args.where.expiresAt.lt) return { count: 0 }
        job.status = args.data.status
        return { count: 1 }
      }),
    },
    importJobRow: {
      count: vi.fn(async (args: { where: { jobId: string } }) => store.rows.filter((r) => r.jobId === args.where.jobId).length),
    },
    auditLog: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        store.audits.push(args)
        return { id: 'al' }
      }),
    },
    $executeRaw: vi.fn(async (parts: TemplateStringsArray, ...vals: unknown[]) => {
      const sql = matchSQL(parts)
      if (sql.includes('UPDATE "ImportJobRow" SET "raw" = NULL')) {
        const jobId = vals[0] as string
        const matched = store.rows.filter((r) => r.jobId === jobId && (r.raw !== null || r.normalized !== null))
        for (const r of matched) {
          r.raw = null
          r.normalized = null
        }
        return matched.length
      }
      return 0
    }),
  }

  const prisma = {
    importJob: {
      findMany: vi.fn(async (args: { where: Record<string, unknown> }) => {
        return store.jobs.filter((j) => {
          const w = args.where
          if (w.status && typeof w.status === 'string' && j.status !== w.status) return false
          if (w.status && typeof w.status === 'object') {
            const notIn = (w.status as { notIn?: string[] }).notIn
            if (notIn && notIn.includes(j.status)) return false
          }
          if (w.committedAt && (w.committedAt as { lt: Date }).lt) {
            if (!j.committedAt || j.committedAt >= (w.committedAt as { lt: Date }).lt) return false
          }
          if (w.updatedAt && (w.updatedAt as { lt: Date }).lt) {
            if (j.updatedAt >= (w.updatedAt as { lt: Date }).lt) return false
          }
          if (w.expiresAt && (w.expiresAt as { lt: Date }).lt) {
            if (j.expiresAt >= (w.expiresAt as { lt: Date }).lt) return false
          }
          return true
        }).map((j) => ({ id: j.id, businessId: j.businessId, userId: j.userId }))
      }),
    },
    $executeRaw: tx.$executeRaw,
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  }
  return { prisma, tx }
}

describe('runImportRetentionCron', () => {
  it('pass 1 — NULLs raw/normalized on COMMITTED jobs older than 24h', async () => {
    const now = new Date('2026-05-18T12:00:00Z')
    const store: Store = {
      jobs: [
        { id: 'j-old', businessId: 'biz', userId: 'u', status: 'COMMITTED', committedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000), updatedAt: now, expiresAt: new Date(now.getTime() + 1e9) },
        { id: 'j-fresh', businessId: 'biz', userId: 'u', status: 'COMMITTED', committedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), updatedAt: now, expiresAt: new Date(now.getTime() + 1e9) },
      ],
      rows: [
        { id: 'r1', jobId: 'j-old', raw: { name: 'x' }, normalized: { name: 'x' } },
        { id: 'r2', jobId: 'j-old', raw: { name: 'y' }, normalized: { name: 'y' } },
        { id: 'r3', jobId: 'j-fresh', raw: { name: 'z' }, normalized: { name: 'z' } },
      ],
      audits: [],
    }
    const { prisma } = buildPrisma(store)
    const summary = await runImportRetentionCron({ prisma: prisma as never, now })
    expect(summary.postCommitJobsPurged).toBe(1)
    expect(summary.postCommitRowsPurged).toBe(2)
    expect(store.rows.find((r) => r.id === 'r1')!.raw).toBeNull()
    expect(store.rows.find((r) => r.id === 'r1')!.normalized).toBeNull()
    expect(store.rows.find((r) => r.id === 'r3')!.raw).not.toBeNull()
  })

  it('pass 2 — reaps orphan PARSING > 5min to FAILED + emits PARSE_TIMEOUT audit', async () => {
    const now = new Date('2026-05-18T12:00:00Z')
    const store: Store = {
      jobs: [
        { id: 'j-stuck', businessId: 'biz', userId: 'u', status: 'PARSING', updatedAt: new Date(now.getTime() - 10 * 60 * 1000), expiresAt: new Date(now.getTime() + 1e9) },
        { id: 'j-running', businessId: 'biz', userId: 'u', status: 'PARSING', updatedAt: new Date(now.getTime() - 1 * 60 * 1000), expiresAt: new Date(now.getTime() + 1e9) },
      ],
      rows: [],
      audits: [],
    }
    const { prisma } = buildPrisma(store)
    const summary = await runImportRetentionCron({ prisma: prisma as never, now })
    expect(summary.orphanParsingReaped).toBe(1)
    expect(store.jobs.find((j) => j.id === 'j-stuck')!.status).toBe('FAILED')
    expect(store.jobs.find((j) => j.id === 'j-running')!.status).toBe('PARSING')
    const timeoutAudit = store.audits.find((a) => (a.data.changes as { event?: string })?.event === 'import_job.parse_timeout')
    expect(timeoutAudit).toBeDefined()
    expect((timeoutAudit!.data.changes as { code?: string }).code).toBe('PARSE_TIMEOUT')
  })

  it('pass 3 — expires non-terminal jobs past expiresAt + NULLs raw + emits expired audit', async () => {
    const now = new Date('2026-05-18T12:00:00Z')
    const store: Store = {
      jobs: [
        { id: 'j-exp', businessId: 'biz', userId: 'u', status: 'PREVIEWED', updatedAt: now, expiresAt: new Date(now.getTime() - 1000) },
        { id: 'j-committed-exp', businessId: 'biz', userId: 'u', status: 'COMMITTED', committedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), updatedAt: now, expiresAt: new Date(now.getTime() - 1000) },
      ],
      rows: [
        { id: 'r1', jobId: 'j-exp', raw: { name: 'x' }, normalized: { name: 'x' } },
      ],
      audits: [],
    }
    const { prisma } = buildPrisma(store)
    const summary = await runImportRetentionCron({ prisma: prisma as never, now })
    expect(summary.expiredJobs).toBe(1)
    expect(store.jobs.find((j) => j.id === 'j-exp')!.status).toBe('EXPIRED')
    // COMMITTED jobs are NEVER re-expired (terminal).
    expect(store.jobs.find((j) => j.id === 'j-committed-exp')!.status).toBe('COMMITTED')
    expect(store.rows.find((r) => r.id === 'r1')!.raw).toBeNull()
    const expAudit = store.audits.find((a) => (a.data.changes as { event?: string })?.event === 'import_job.expired')
    expect(expAudit).toBeDefined()
  })

  it('idempotent — second run is a no-op', async () => {
    const now = new Date('2026-05-18T12:00:00Z')
    const store: Store = {
      jobs: [
        { id: 'j-old', businessId: 'biz', userId: 'u', status: 'COMMITTED', committedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000), updatedAt: now, expiresAt: new Date(now.getTime() + 1e9) },
      ],
      rows: [{ id: 'r1', jobId: 'j-old', raw: { name: 'x' }, normalized: { name: 'x' } }],
      audits: [],
    }
    const { prisma } = buildPrisma(store)
    await runImportRetentionCron({ prisma: prisma as never, now })
    const second = await runImportRetentionCron({ prisma: prisma as never, now })
    expect(second.postCommitRowsPurged).toBe(0)
  })
})
