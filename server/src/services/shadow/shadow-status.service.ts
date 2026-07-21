/**
 * Admin status read (File #37, ARCHITECTURE §8.2, §8.3, M-1).
 *
 * Assembles the one payload an operator uses to decide whether the `enforce`
 * cutover is justified. Everything durable is read here; everything in-process
 * comes from `port.snapshot()` and is passed through untouched (B-3, N-1).
 *
 * ── Why every read is wrapped in `runUnscoped` (M-1) ──────────────────────────
 *
 * Both shadow tables are platform-wide by design: they hold rows from every
 * tenant and carry no `businessId` column to scope on. Under `enforce` the
 * extension fails closed on a scoped model with no tenant frame — but these two
 * models are not in `scoped-models.ts`, so nothing would inject and nothing would
 * refuse either. The wrapper is therefore not load-bearing for correctness today;
 * it is here because a platform-wide read that ISN'T declared as one is
 * indistinguishable from a tenant read that lost its frame, and the audit row is
 * how the difference stays visible. This is the sanctioned cross-tenant path.
 *
 * ── Two numbers that are honest rather than tidy ──────────────────────────────
 *
 * The divergence table is DEDUPED (`@@unique` on the shape key, D-11): a repeat
 * sighting increments `suppressed` instead of writing a row. So an event count
 * reconstructed as `rows + Σ suppressed` covers each row's whole life, not just
 * the window — it over-reports for a long-lived row. Stated rather than hidden,
 * because the only sub-population that gates anything (`noContextHttpFrameLost`,
 * §6.3) is gated at ZERO, and an upper bound cannot turn a non-zero into a zero.
 *
 * `includeBlindFraction`'s denominator is divergence rows, not samples, because
 * `hasInclude` is not carried on the stats table. It answers "how much of the
 * anomaly population was partly uncompared", not "of all traffic".
 */
import { createHash } from 'crypto'
import { runUnscoped } from '../../lib/business-context.js'
import { prisma } from '../../lib/prisma.js'
import { getShadowPort } from '../../lib/prisma-scoped.shadow.js'
import { createShadowStats } from '../../lib/prisma-shadow.stats.js'
import {
  SHADOW_STATUS_RECENT_LIMIT,
  SHADOW_STATUS_WINDOW_HOURS,
} from '../../lib/prisma-shadow.constants.js'
import {
  getScopedPrismaMode,
  getScopedPrismaShadowSample,
} from '../../lib/env.scoped-prisma.js'
import type { ShadowDb, ShadowPort } from '../../lib/prisma-shadow.types.js'
import type { ScopedShadowRecentRow, ScopedShadowStatus } from './shadow-status.types.js'

/**
 * The reads this service needs, on top of the write surface `ShadowDb` declares.
 * Structural, like `ShadowDb` and for the same reason (AA-6): naming
 * `PrismaClient` here would put a `prisma.ts` import back on the shadow graph.
 */
export interface ShadowStatusDb extends ShadowDb {
  scopedShadowDivergence: ShadowDb['scopedShadowDivergence'] & {
    findMany(args?: unknown): Promise<unknown>
    findFirst(args?: unknown): Promise<unknown>
  }
}

interface DivergenceRow {
  kind: string
  model: string
  operation: string
  subjectBusinessId: string | null
  unscopedCount: number
  scopedCount: number
  onlyUnscoped: string[]
  onlyScoped: string[]
  truncated: boolean
  suppressed: number
  routeHint: string
  provenance: string
  hadBusinessOnToken: boolean
  hasInclude: boolean
  hasBoundedWindow: boolean
  observationIntervalMs: number
  errorName: string | null
  lastSeenAt: Date
}

interface NoContextGroup {
  provenance: string
  hadBusinessOnToken: boolean
  _count: { _all: number }
  _sum: { suppressed: number | null }
}

export interface ShadowStatusOpts {
  db?: ShadowStatusDb
  port?: ShadowPort | null
  now?: number
  windowHours?: number
}

/** FM-13/AC-27: the tenant id never leaves the process, in any payload, ever. */
function hashBusinessId(id: string | null): string | null {
  return id === null ? null : createHash('sha256').update(id).digest('hex').slice(0, 12)
}

function toRecentRow(r: DivergenceRow): ScopedShadowRecentRow {
  return {
    kind: r.kind as ScopedShadowRecentRow['kind'],
    model: r.model,
    operation: r.operation,
    businessIdHash: hashBusinessId(r.subjectBusinessId),
    unscopedCount: r.unscopedCount,
    scopedCount: r.scopedCount,
    onlyUnscoped: r.onlyUnscoped,
    onlyScoped: r.onlyScoped,
    truncated: r.truncated,
    suppressed: r.suppressed,
    // '' means "no route was matched" — distinct from a route literally named ''.
    routeHint: r.routeHint === '' ? null : r.routeHint,
    provenance: r.provenance as ScopedShadowRecentRow['provenance'],
    hadBusinessOnToken: r.hadBusinessOnToken,
    hasInclude: r.hasInclude,
    hasBoundedWindow: r.hasBoundedWindow,
    observationIntervalMs: r.observationIntervalMs,
    errorName: r.errorName,
    lastSeenAt: r.lastSeenAt.toISOString(),
  }
}

/** Events, not rows — see the dedupe note in the module header. */
function eventsIn(g: NoContextGroup): number {
  return g._count._all + (g._sum.suppressed ?? 0)
}

export async function getShadowStatus(opts: ShadowStatusOpts = {}): Promise<ScopedShadowStatus> {
  const db = opts.db ?? (prisma as unknown as ShadowStatusDb)
  const port = opts.port !== undefined ? opts.port : getShadowPort()
  const now = opts.now ?? Date.now()
  const windowHours = opts.windowHours ?? SHADOW_STATUS_WINDOW_HOURS
  const since = new Date(now - windowHours * 3_600_000)
  const inWindow = { lastSeenAt: { gte: since } }

  const stats = createShadowStats({ db, now: () => now })

  return runUnscoped('platform.admin', async () => {
    const [counts, distinctFramedRoutes, recentRows, noContext, timedOut, canary, total, blind] =
      await Promise.all([
        stats.countsByKind(since.getTime()),
        stats.distinctFramedRoutes(since.getTime()),
        db.scopedShadowDivergence.findMany({
          where: inWindow,
          orderBy: { lastSeenAt: 'desc' },
          take: SHADOW_STATUS_RECENT_LIMIT,
        }) as Promise<DivergenceRow[]>,
        db.scopedShadowDivergence.groupBy({
          by: ['provenance', 'hadBusinessOnToken'],
          where: { kind: 'no-context', ...inWindow },
          _count: { _all: true },
          _sum: { suppressed: true },
        }) as Promise<NoContextGroup[]>,
        // A subset of `shadow-error`, kept separate because a probe losing its
        // race and a probe throwing have different diagnoses and different fixes.
        db.scopedShadowDivergence.count({
          where: { kind: 'shadow-error', errorName: 'ShadowProbeTimeout', ...inWindow },
        }),
        db.scopedShadowDivergence.findFirst({
          where: { kind: 'canary' },
          orderBy: { lastSeenAt: 'desc' },
        }) as Promise<{ lastSeenAt: Date } | null>,
        db.scopedShadowDivergence.count({ where: inWindow }),
        db.scopedShadowDivergence.count({ where: { hasInclude: true, ...inWindow } }),
      ])

    const noCtx = (provenance: string, onToken?: boolean): number =>
      noContext
        .filter((g) => g.provenance === provenance && (onToken === undefined || g.hadBusinessOnToken === onToken))
        .reduce((sum, g) => sum + eventsIn(g), 0)

    const snap = port?.snapshot()
    const mode = getScopedPrismaMode()
    const configuredSample = getScopedPrismaShadowSample()

    return {
      mode,
      boundClient: mode === 'off' ? 'softDeleted' : 'scoped',
      shadowPortInstalled: port !== null,
      configuredSample,
      // With no port there is no throttle, so the configured rate IS the rate in
      // force — reporting 0 would read as "throttled to nothing" rather than "off".
      effectiveSample: snap?.effectiveSample ?? configuredSample,
      breakerOpen: snap?.breakerOpen ?? false,
      rawSqlSitesUnaudited: true,
      canaryLastSeenAt: canary?.lastSeenAt.toISOString() ?? null,
      includeBlindFraction: total === 0 ? 0 : blind / total,
      distinctFramedRoutes,
      windowHours,
      windowCounts: {
        sampled: counts['sampled'] ?? 0,
        observedFramed: counts['observed-framed'] ?? 0,
        diverged: counts['diverged'] ?? 0,
        unstableWindow: counts['unstable-window'] ?? 0,
        skewSuspect: counts['skew-suspect'] ?? 0,
        noContextHttpFrameLost: noCtx('http', true),
        noContextHttpPreBusiness: noCtx('http', false),
        noContextJob: noCtx('job'),
        shadowError: counts['shadow-error'] ?? 0,
        timedOut,
        unsupportedShape: counts['unsupported-shape'] ?? 0,
        sinkWriteFailed: snap?.sinkWriteFailed ?? 0,
        sinkShed: snap?.sinkShed ?? 0,
        throttled: snap?.throttled ?? 0,
      },
      recent: recentRows.map(toRecentRow),
    }
  })
}
