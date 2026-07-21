/**
 * Shadow-harness watchdog (File #33, ARCHITECTURE §15.1, SR-1).
 *
 * ── The failure this exists for ───────────────────────────────────────────
 *
 * SCOPE's alerts 1 and 2 are conditioned "while mode is `shadow`", and `mode` is
 * `getScopedPrismaMode()` reading the same `SCOPED_PRISMA_ENFORCE` whose loss IS
 * the failure. On Render that is a hand-set `sync: false` var. A typo (`shadown`)
 * or a dropped var parses as `off` (`env.scoped-prisma.ts`), the harness goes
 * inert, and both alerts stay silent BY CONSTRUCTION while the 7-day watch burns
 * to completion for nothing.
 *
 * Two properties close that, and both are easy to undo by accident:
 *
 *   1. **Registered unconditionally.** No mode check at the registration site in
 *      `cron-scheduler.ts`. Adoption assertion A7 asserts the registration with
 *      mode `off` — asserting it under `shadow` would pass for a watchdog wired
 *      exactly as uselessly as the alerts it replaces.
 *   2. **The predicate is over DURABLE ROWS, never a live env read.** Whether a
 *      watch is in progress is inferred from `ScopedShadowStat` activity in the
 *      last 24h. That is what lets it survive the exact env-var loss it detects.
 *
 * A `SHADOW_WATCH_ACTIVE` env var was considered and declined: it is one more
 * hand-set Render var — the same class of artefact whose loss is the failure.
 *
 * ── Why it is quiet when it should be ─────────────────────────────────────
 *
 * No activity in 24h ⇒ silent. That covers both "no watch is running" (correct)
 * and the drain after an intentionally-ended watch, so the job does not have to
 * be de-registered to stop paging. Boot under `shadow` writes a `watch-active`
 * row (`lib/boot-guards.ts`) so the watchdog arms from the first minute rather
 * than from the first sampled query.
 *
 * This is the complement of B-3: `sinkWriteFailed` is an IN-PROCESS counter
 * because reporting a failed DB write by writing to the DB is the same defect one
 * level down — and this job's durable `sampled = 0` page is what covers the
 * restart that clears that counter.
 */

import { prisma as defaultPrisma } from '../lib/prisma.js'
import type { ExtendedPrismaClient } from '../lib/prisma.js'
import logger from '../lib/logger.js'
import { Sentry } from '../lib/sentry.js'
import { hourBucket } from '../lib/prisma-shadow.stats.js'
import {
  SHADOW_CANARY_MAX_AGE_MS,
  SHADOW_WATCHDOG_ACTIVITY_WINDOW_MS,
} from '../lib/prisma-shadow.constants.js'

/** Kinds whose presence means "a watch is in progress". */
const ACTIVITY_KINDS = ['sampled', 'watch-active']

export type WatchdogVerdict =
  /** No durable activity in 24h — no watch running. Correct silence. */
  | 'idle'
  /** Activity present, current+previous hour sampled = 0, canary fresh. */
  | 'harness-silent'
  /** Activity present, canary older than 45 min (or never seen). */
  | 'canary-missing'
  /** Both of the above. */
  | 'harness-silent-and-canary-missing'
  /** Watch in progress and healthy. */
  | 'ok'

export interface WatchdogResult {
  verdict: WatchdogVerdict
  sampledThisHour: number
  sampledPrevHour: number
  canaryAgeMs: number | null
}

interface RunOpts {
  prisma?: ExtendedPrismaClient
  now?: Date
}

interface StatRow {
  kind: string
  count: number
  hourBucket: Date
}

function page(message: string, context: Record<string, unknown>): void {
  logger.error(`shadow.watchdog.PAGE — ${message}`, context)
  Sentry.captureException(new Error(`Shadow watchdog: ${message}`), {
    fingerprint: ['shadow', 'watchdog', message],
  })
}

/** One watchdog tick. Never reads the mode — that is the entire point (SR-1). */
export async function runShadowWatchdog(opts: RunOpts = {}): Promise<WatchdogResult> {
  const prisma = opts.prisma ?? defaultPrisma
  const now = opts.now ?? new Date()
  const nowMs = now.getTime()

  const rows = (await prisma.scopedShadowStat.findMany({
    where: {
      kind: { in: ACTIVITY_KINDS },
      hourBucket: { gte: new Date(nowMs - SHADOW_WATCHDOG_ACTIVITY_WINDOW_MS) },
    },
    select: { kind: true, count: true, hourBucket: true },
  })) as StatRow[]

  // No durable evidence of a watch. Say nothing — a watchdog that pages when
  // nothing is running gets muted, and a muted watchdog is not a control.
  if (rows.length === 0) {
    return { verdict: 'idle', sampledThisHour: 0, sampledPrevHour: 0, canaryAgeMs: null }
  }

  const thisBucket = hourBucket(nowMs).getTime()
  const prevBucket = hourBucket(nowMs - 3_600_000).getTime()
  let sampledThisHour = 0
  let sampledPrevHour = 0
  for (const r of rows) {
    if (r.kind !== 'sampled') continue
    const b = r.hourBucket.getTime()
    if (b === thisBucket) sampledThisHour += r.count
    else if (b === prevBucket) sampledPrevHour += r.count
  }

  const canary = (await prisma.scopedShadowDivergence.findFirst({
    where: { kind: 'canary' },
    select: { lastSeenAt: true },
    orderBy: { lastSeenAt: 'desc' },
  })) as { lastSeenAt: Date } | null
  const canaryAgeMs = canary ? nowMs - canary.lastSeenAt.getTime() : null

  // Both hours at zero, not just the current one: the current bucket is partial
  // for its first minutes, so gating on it alone pages on every hour boundary.
  const harnessSilent = sampledThisHour === 0 && sampledPrevHour === 0
  const canaryMissing = canaryAgeMs === null || canaryAgeMs > SHADOW_CANARY_MAX_AGE_MS

  if (harnessSilent) {
    page('shadow harness went silent', { sampledThisHour, sampledPrevHour })
  }
  if (canaryMissing) {
    page('canary MISSING', { canaryAgeMs, maxAgeMs: SHADOW_CANARY_MAX_AGE_MS })
  }

  const verdict: WatchdogVerdict =
    harnessSilent && canaryMissing
      ? 'harness-silent-and-canary-missing'
      : harnessSilent
        ? 'harness-silent'
        : canaryMissing
          ? 'canary-missing'
          : 'ok'

  return { verdict, sampledThisHour, sampledPrevHour, canaryAgeMs }
}

/** Wrapper for cron-scheduler invocation; never throws. */
export async function runShadowWatchdogJob(): Promise<void> {
  try {
    await runShadowWatchdog()
  } catch (e) {
    logger.error('shadow.watchdog.fatal', {
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
