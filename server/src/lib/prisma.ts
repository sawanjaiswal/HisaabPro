/**
 * Prisma singleton — HisaabPro
 * Connection pooling (10) + soft-delete extension + slow query logging
 * + tenant-scoping extension (flag-gated, land-dark by default — Wave A P0.1).
 *
 * Composition: base.$extends(softDelete).$extends(scoping). Prisma runs the LAST
 * query extension FIRST, so scoping → soft-delete → DB. `getInner` is late-bound to
 * the soft-delete client (no scoping layer) so a re-dispatch can't re-enter scoping.
 *
 * The exported `prisma` is the SCOPED client only when SCOPED_PRISMA_ENFORCE=enforce;
 * otherwise it is exactly the previous soft-delete client (zero behavior change).
 * `__basePrismaUnsafe` is the raw base client — the ONLY sanctioned unscoped handle
 * (runUnscoped audit sink, migrations, platform admin), CI-lint-guarded (#11).
 */

import { PrismaClient } from '@prisma/client'
import logger from './logger.js'
import { createSoftDeleteExtension } from './soft-delete/index.js'
import { setUnscopedAuditSink } from './business-context.js'
import { createScopingExtension, makeScopedTransaction, type ScopedClientLike } from './prisma-scoped.js'
import { getScopedPrismaMode } from './env.js'

function getDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) {
    throw new Error('FATAL: DATABASE_URL environment variable is required')
  }
  if (baseUrl.includes('connection_limit')) return baseUrl
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}connection_limit=10&pool_timeout=30`
}

import { SLOW_QUERY_THRESHOLD_MS as DEFAULT_SLOW_THRESHOLD } from '../config/security.js'

const SLOW_QUERY_THRESHOLD_MS = Number(process.env.SLOW_QUERY_MS) || DEFAULT_SLOW_THRESHOLD

function buildClients() {
  const logConfig = process.env.NODE_ENV === 'development'
    ? [{ level: 'query' as const, emit: 'event' as const }, 'warn' as const, 'error' as const]
    : [{ level: 'query' as const, emit: 'event' as const }, 'error' as const]

  const base = new PrismaClient({
    log: logConfig,
    datasources: {
      db: { url: getDatabaseUrl() },
    },
    // Global transaction defaults — prevents runaway interactive transactions
    // (prior default of 5s was too short for bulk imports and FY closure;
    // 20s covers the heaviest writes while still failing fast on deadlocks).
    transactionOptions: {
      timeout: 20_000,
      maxWait: 5_000,
    },
  })

  // Log slow queries (configurable via SLOW_QUERY_MS env, default 500ms)
  base.$on('query', (e) => {
    if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn('Slow query detected', {
        duration: `${e.duration}ms`,
        query: e.query.slice(0, 200),
        params: e.params?.slice(0, 100),
      })
    }
  })

  // INNER: soft-delete (auto-filter + delete interception). OUTER: tenant-scoping,
  // re-dispatching on the late-bound soft-delete client so businessId merges once.
  const softDeleted = base.$extends(createSoftDeleteExtension())
  const scoped = softDeleted.$extends(
    createScopingExtension(() => softDeleted as unknown as ScopedClientLike),
  )

  // The runUnscoped audit sink — a global write on the RAW base client (never scoped),
  // fire-and-forget so an unscoped window is never blocked by its own audit row.
  setUnscopedAuditSink((entry) => {
    void base.unscopedAccessLog
      .create({
        data: {
          reason: entry.reason,
          subjectUserId: entry.userId,
          subjectBusinessId: entry.businessId,
        },
      })
      .catch((err: unknown) => logger.error('Failed to write UnscopedAccessLog', { err: String(err) }))
  })

  return { base, softDeleted, scoped }
}

type PrismaClients = ReturnType<typeof buildClients>
type SoftDeletedClient = PrismaClients['softDeleted']

const globalForPrisma = globalThis as unknown as { __hpPrismaClients?: PrismaClients }
const clients = globalForPrisma.__hpPrismaClients ?? buildClients()
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__hpPrismaClients = clients
}

/** Raw, UNSCOPED base client. Do not import in feature code (CI-lint #11 blocks it). */
export const __basePrismaUnsafe = clients.base

const scopedMode = getScopedPrismaMode()

/**
 * The app-wide Prisma client. Scoped only under `enforce`; otherwise the previous
 * soft-delete client (land-dark). Typed as the soft-delete client — the scoping
 * extension is a query-only component and does not change the delegate surface.
 */
export const prisma: SoftDeletedClient =
  scopedMode === 'enforce' ? (clients.scoped as unknown as SoftDeletedClient) : clients.softDeleted

/** Type of the extended prisma client — use this instead of PrismaClient in service signatures */
export type ExtendedPrismaClient = SoftDeletedClient

/**
 * Tenant-safe interactive transaction. Threads the tx client into the scoping ALS slot
 * so two-step writes stay atomic. Use this (not `prisma.$transaction`) once a service is
 * migrated to scoped Prisma.
 */
export const scopedTransaction = makeScopedTransaction(
  clients.scoped as unknown as { $transaction: <T>(fn: (tx: unknown) => Promise<T>, opts?: unknown) => Promise<T> },
)

logger.info(`Database connection initialized (soft-delete active, scoped-prisma mode=${scopedMode})`)
