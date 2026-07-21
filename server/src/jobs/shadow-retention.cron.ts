/**
 * Shadow-harness retention (File #31, ARCHITECTURE §7.4, D-14/M-5).
 *
 * Two tables, three predicates, one nightly tick:
 *
 *   1. `ScopedShadowDivergence` where `lastSeenAt < now - 30d`  — the row has
 *      stopped firing and has aged out.
 *   2. `ScopedShadowDivergence` where `createdAt  < now - 180d` — the ABSOLUTE
 *      ceiling. Without it a continuously-firing row is never deleted, and since
 *      a row pairs `subjectBusinessId` with up to 20 ids belonging to OTHER
 *      tenants (§9.3), "never deleted" means an indefinitely-retained
 *      cross-tenant identifier linkage. That is a DPDP erasure problem, not a
 *      bloat problem, which is why the second predicate exists at all.
 *   3. `ScopedShadowStat` where `hourBucket < now - 180d` — counters only, no
 *      identifiers, so one plain rule.
 *
 * Why `lastSeenAt` and not `createdAt` for (1): the dedupe upsert increments
 * `suppressed` on an existing row, so `createdAt` stays pinned at first-sight. An
 * age-on-createdAt rule would delete the row that is still actively firing —
 * silently erasing the hottest divergence in the system on day 31.
 *
 * DISJOINTNESS (C4). This job deletes from the table the cutover decision reads.
 * It is safe because every exit query runs over a 7-day `lastSeenAt` window and
 * this deletes at 30 days: a row that fired *during* the window cannot satisfy
 * the delete predicate. That is arithmetic, not an argument — and
 * `lib/boot-guards.ts` asserts the two constants still satisfy it at every boot,
 * because the real exposure is a later config edit, not this code.
 *
 * Idempotent, capped per tick, and never throws out of `runShadowRetentionJob`.
 */

import { prisma as defaultPrisma } from '../lib/prisma.js'
import type { ExtendedPrismaClient } from '../lib/prisma.js'
import logger from '../lib/logger.js'
import {
  SHADOW_RETENTION_ABSOLUTE_DAYS,
  SHADOW_RETENTION_LAST_SEEN_DAYS,
  SHADOW_RETENTION_MAX_DELETES,
  SHADOW_STAT_RETENTION_DAYS,
} from '../lib/prisma-shadow.constants.js'

export interface ShadowRetentionSummary {
  /** Deleted because they stopped firing 30 days ago. */
  staleDeleted: number
  /** Deleted by the absolute 180-day ceiling while still firing (M-5). */
  absoluteDeleted: number
  /** `ScopedShadowStat` rows past the 180-day counter rule. */
  statsDeleted: number
  /** A ceiling hit its per-tick cap; the remainder drains tomorrow. */
  capped: boolean
}

const ZERO: ShadowRetentionSummary = {
  staleDeleted: 0,
  absoluteDeleted: 0,
  statsDeleted: 0,
  capped: false,
}

interface RunOpts {
  prisma?: ExtendedPrismaClient
  now?: Date
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

/**
 * Delete at most `SHADOW_RETENTION_MAX_DELETES` ids matching `where`.
 *
 * Two steps rather than one `deleteMany`: an unbounded `deleteMany` over a
 * bloated table holds row locks on the table the operator is mid-triage in.
 * Selecting ids first bounds the write, and `@@index([lastSeenAt])` /
 * `@@index([createdAt])` make the select cheap.
 */
async function deleteCapped(
  prisma: ExtendedPrismaClient,
  where: Record<string, unknown>,
): Promise<{ deleted: number; capped: boolean }> {
  const doomed = await prisma.scopedShadowDivergence.findMany({
    where,
    select: { id: true },
    take: SHADOW_RETENTION_MAX_DELETES,
    orderBy: { lastSeenAt: 'asc' },
  })
  if (doomed.length === 0) return { deleted: 0, capped: false }

  const res = await prisma.scopedShadowDivergence.deleteMany({
    where: { id: { in: doomed.map((r) => r.id) } },
  })
  return { deleted: res.count, capped: doomed.length === SHADOW_RETENTION_MAX_DELETES }
}

/** One-shot retention pass. Exported so node-cron, tests, and CLIs share it. */
export async function runShadowRetention(
  opts: RunOpts = {},
): Promise<ShadowRetentionSummary> {
  const prisma = opts.prisma ?? defaultPrisma
  const now = opts.now ?? new Date()
  const summary: ShadowRetentionSummary = { ...ZERO }

  // ── Ceiling 1: stopped firing 30 days ago ───────────────────────────
  const stale = await deleteCapped(prisma, {
    lastSeenAt: { lt: daysAgo(now, SHADOW_RETENTION_LAST_SEEN_DAYS) },
  })
  summary.staleDeleted = stale.deleted
  summary.capped ||= stale.capped

  // ── Ceiling 2: absolute age, still firing (M-5, the linkage bound) ──
  const absolute = await deleteCapped(prisma, {
    createdAt: { lt: daysAgo(now, SHADOW_RETENTION_ABSOLUTE_DAYS) },
  })
  summary.absoluteDeleted = absolute.deleted
  summary.capped ||= absolute.capped

  // ── Stat counters: no identifiers, one flat rule ────────────────────
  const stats = await prisma.scopedShadowStat.deleteMany({
    where: { hourBucket: { lt: daysAgo(now, SHADOW_STAT_RETENTION_DAYS) } },
  })
  summary.statsDeleted = stats.count

  // The runbook reads this line beside every exit-criteria query — the two are
  // never interpreted in isolation, because this job deletes from that table.
  logger.info('shadow.retention.done', { ...summary })
  return summary
}

/** Wrapper for cron-scheduler invocation; never throws. */
export async function runShadowRetentionJob(): Promise<void> {
  try {
    await runShadowRetention()
  } catch (e) {
    logger.error('shadow.retention.fatal', {
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
