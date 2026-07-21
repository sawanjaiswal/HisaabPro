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
import {
  createScopingExtension,
  makeScopedTransaction,
  setShadowPort,
  type ScopedClientLike,
} from './prisma-scoped.js'
import { createShadowPort } from './prisma-shadow.js'
import type { ShadowDb } from './prisma-shadow.types.js'
// barrel row deferred — env.ts is owned by a concurrent session (epic: scoped-prisma-shadow)
import {
  getScopedPrismaShadowSample,
  getScopedPrismaShadowTimeoutMs,
} from './env.scoped-prisma.js'
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
 * Install the shadow harness (§3.1). Under `shadow` ONLY.
 *
 * Two lines make shadow mode real — this one and the `prisma` resolution below —
 * and neither is useful alone: a port with `prisma` on the unscoped client observes
 * nothing, and the scoped client with no port is just `enforce` without enforcement.
 * The adoption assertion fails if either is deleted, which is the whole point: this
 * epic exists because four components typechecked, grepped clean, and were never
 * called by anything.
 *
 * `clients.base` is referenced as a local const, NOT via the `__basePrismaUnsafe`
 * export above. That removes the AA-6 declaration-order fragility at its source
 * rather than leaving it as a constraint the next editor has to remember.
 */
if (scopedMode === 'shadow') {
  setShadowPort(
    createShadowPort({
      db: clients.base as unknown as ShadowDb,
      sampleRate: getScopedPrismaShadowSample(),
      timeoutMs: getScopedPrismaShadowTimeoutMs(),
    }),
  )
}

/**
 * The app-wide Prisma client (§3.1, three-way).
 *
 *   off      → soft-delete client; the scoping extension is not on the path
 *   shadow   → scoped client; the harness branch returns the UNSCOPED result, so
 *              runtime behaviour is unchanged while the diff is observed
 *   enforce  → scoped client; injection is load-bearing
 *
 * Typed as the soft-delete client — the scoping extension is query-only and does
 * not change the delegate surface, so none of the 186 service call sites change.
 */
export const prisma: SoftDeletedClient =
  scopedMode === 'off'
    ? clients.softDeleted
    : (clients.scoped as unknown as SoftDeletedClient)

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

// `client=` is load-bearing operator evidence, not decoration: it is the one line
// that tells "shadow wired" apart from "shadow parsed and ignored", and it is the
// runbook's first triage step.
logger.info(
  `Database connection initialized (soft-delete active, scoped-prisma mode=${scopedMode}, ` +
    `client=${scopedMode === 'off' ? 'soft-delete' : 'scoped'}` +
    `${scopedMode === 'shadow' ? `, shadow-sample=${getScopedPrismaShadowSample()}` : ''})`,
)
