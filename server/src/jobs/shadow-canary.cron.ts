/**
 * Shadow-harness positive control (File #32, ARCHITECTURE §9.3 control 4, D-15).
 *
 * Every other signal in this epic is a NEGATIVE control: "no divergence rows" is
 * the outcome we want AND the outcome a completely broken harness produces. The
 * canary is the one signal that distinguishes them. Its rule:
 *
 *   a `canary` row is written ONLY when the deliberate cross-tenant read was
 *   actually filtered.
 *
 * Presence therefore means "scoping still works and the sink still writes";
 * absence for 45 minutes pages (AC-18, `shadow-watchdog.cron.ts`). A canary that
 * wrote its row unconditionally would prove only that node-cron fired, which is
 * not the thing in doubt.
 *
 * ── The fixture is synthetic, and that is load-bearing (D-15) ──────────────
 *
 * SCOPE:413-416 specified the canary as an unbounded `findMany` with no tenant
 * predicate. That form returns other tenants' rows by design, so the positive
 * control would persist a 20-id sample of REAL production ids into a durable,
 * admin-readable table every 15 minutes, forever, as its steady state — making
 * the control itself the largest recurring source of exactly the cross-tenant
 * identifier linkage §9.3 exists to bound. Instead the read is
 * `{ id: { in: CANARY_FIXTURE_IDS } }` over two seeded synthetic rows: `SELF` in
 * the canary business, `FOREIGN` in a second synthetic business. It fails just as
 * loudly, and neither id names a real tenant's row.
 *
 * Fixture seeding is an operator step, not this job's (runbook, File #48). A
 * missing fixture reads as "control not proving anything" — no row, watchdog
 * pages — which is the correct interpretation, not a false green.
 *
 * ── What this exercises, stated honestly ──────────────────────────────────
 *
 * It runs `injectScope` — the injection core whose bug IS the leak — against a
 * real DB round-trip on the base client. It does NOT go through the extension's
 * `$allOperations` dispatch, because under `shadow` that branch deliberately
 * returns the UNSCOPED result (§3.1 (3)) and `shouldShadow` is sampled, so the
 * app client can neither give this job a scoped answer nor be relied on to
 * observe it. Dispatch coverage is A1/A2's job (File #46), not the canary's.
 */

import { __basePrismaUnsafe } from '../lib/prisma.js'
import logger from '../lib/logger.js'
import { Sentry } from '../lib/sentry.js'
import { getScopedPrismaMode, getScopedPrismaShadowCanaryBusinessId } from '../lib/env.scoped-prisma.js'
import { injectScope } from '../lib/prisma-scoped.inject.js'
import { createShadowSink } from '../lib/prisma-shadow.sink.js'
import { createShadowStats } from '../lib/prisma-shadow.stats.js'
import { buildRecord } from '../lib/prisma-shadow.redact.js'
import {
  CANARY_FIXTURE_IDS,
  SHADOW_CANARY_FOREIGN_ID,
  SHADOW_CANARY_MODEL,
  SHADOW_CANARY_SELF_ID,
} from '../lib/prisma-shadow.constants.js'
import type { ScopedPrismaMode } from '../lib/env.scoped-prisma.js'
import type { ShadowDb, ShadowDiff } from '../lib/prisma-shadow.types.js'

export type CanaryOutcome =
  /** Not applicable: mode `off`, or no canary business configured. */
  | 'skipped'
  /** Scoping filtered the foreign row — a `canary` row was written. */
  | 'detected'
  /** The fixture is missing or incomplete. No row; the watchdog will page. */
  | 'fixture-missing'
  /** The read came back UNFILTERED. No row; this is the failure being watched for. */
  | 'not-detected'

export interface CanaryResult {
  outcome: CanaryOutcome
  /** Ids the scoped read returned. Synthetic by construction — safe to log. */
  seen: string[]
}

interface RunOpts {
  db?: ShadowDb & { party: { findMany(args: unknown): Promise<unknown> } }
  businessId?: string
  /**
   * Injectable so the skip branch is a TESTED branch rather than an untestable
   * one. Reading the mode straight from the env inside the guard would make the
   * `off` path the only reachable one under vitest — the control's own failure
   * modes would then be asserted by nothing.
   */
  mode?: ScopedPrismaMode
}

/** One canary tick. Exported so cron, tests, and a manual CLI share one path. */
export async function runShadowCanary(opts: RunOpts = {}): Promise<CanaryResult> {
  const businessId = opts.businessId ?? getScopedPrismaShadowCanaryBusinessId()
  const mode = opts.mode ?? getScopedPrismaMode()
  if (!businessId || mode === 'off') {
    return { outcome: 'skipped', seen: [] }
  }

  // Held, not passed as an argument: the token in an argument position is the B-5
  // handoff shape, and the handoff that DOES happen here (into `createShadowSink`
  // / `createShadowStats`) is the same injected-client shape §7.6 already covers —
  // both write only to the two shadow tables, neither of which is tenant-scoped.
  const db = (opts.db ?? __basePrismaUnsafe) as NonNullable<RunOpts['db']>


  // The real injection core, on the real model, with the real tenant predicate.
  const plan = injectScope(
    SHADOW_CANARY_MODEL,
    'findMany',
    { where: { id: { in: [...CANARY_FIXTURE_IDS] } }, select: { id: true } },
    businessId,
  )
  if (plan.exec.kind !== 'sameOp') {
    // A findMany on a directly-scoped model is a `sameOp` merge. Anything else
    // means the injector changed shape underneath this control.
    logger.error('shadow.canary.plan_shape', { kind: plan.exec.kind })
    return { outcome: 'not-detected', seen: [] }
  }

  const rows = (await db.party.findMany(plan.exec.args)) as { id: string }[]
  const seen = rows.map((r) => r.id).sort()

  // The assertion is exact in BOTH directions. `seen.length === 1` would pass
  // when the fixture is half-seeded and the filter is dead.
  if (!seen.includes(SHADOW_CANARY_SELF_ID)) {
    logger.error('shadow.canary.fixture_missing', { seen })
    return { outcome: 'fixture-missing', seen }
  }
  if (seen.includes(SHADOW_CANARY_FOREIGN_ID)) {
    // The canary read another tenant's row. Under `shadow` this is the harness's
    // whole reason to exist showing up in its own control.
    logger.error('shadow.canary.NOT_DETECTED — scoped read returned the foreign fixture row')
    Sentry.captureException(new Error('Shadow canary: cross-tenant fixture row was not filtered'), {
      fingerprint: ['shadow', 'canary-not-detected'],
    })
    return { outcome: 'not-detected', seen }
  }

  // Detected. The row is the heartbeat; the diff records what was filtered.
  const diff: ShadowDiff = {
    onlyUnscoped: [SHADOW_CANARY_FOREIGN_ID],
    onlyScoped: [],
    unscopedCount: CANARY_FIXTURE_IDS.length,
    scopedCount: seen.length,
    truncated: false,
    unsupportedShape: false,
  }
  const record = buildRecord('canary', diff, {
    model: SHADOW_CANARY_MODEL,
    operation: 'findMany',
    meta: undefined, // provenance `job` — there is no Express request here
    subjectBusinessId: businessId,
    observationIntervalMs: 0,
    argFlags: { hasInclude: false, hasBoundedWindow: false },
  })

  // The dedupe upsert collapses every tick onto ONE row and refreshes its
  // `lastSeenAt` — which is precisely what the watchdog reads, and why the canary
  // costs one row rather than 35 000 a year.
  const sink = createShadowSink({ db })
  await sink.write(record)
  await createShadowStats({ db }).bump(['canary'])

  return { outcome: 'detected', seen }
}

/** Wrapper for cron-scheduler invocation; never throws. */
export async function runShadowCanaryJob(): Promise<void> {
  try {
    await runShadowCanary()
  } catch (e) {
    logger.error('shadow.canary.fatal', {
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
