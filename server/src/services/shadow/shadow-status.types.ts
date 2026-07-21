/**
 * Admin status payload contract (File #37a, ARCHITECTURE §8.2).
 *
 * Split out of `shadow-status.service.ts`: the contract is what the route, the
 * route's test, and any future operator UI bind to, and none of those should have
 * to import the query layer to name a field.
 *
 * Two shapes in here are deliberately NOT symmetrical with the rest, and the
 * asymmetry is the point (§5.2, §15.1, B-3/N-1):
 *
 *   - `sinkWriteFailed` / `sinkShed` / `throttled` are IN-PROCESS counters. They
 *     reset on restart and are never read from the database, because reporting a
 *     failed DB write by reading the DB is the counter-dependence defect §15.1
 *     exists to forbid. Their durable twin is the watchdog's `sampled = 0` page.
 *   - `timedOut` is a SUBSET of `shadowError`, not a sibling. Summing the two
 *     double-counts every probe that lost its race.
 */
import type { ShadowKind, ShadowProvenance } from '../../lib/prisma-shadow.types.js'

/** Which client `prisma` actually resolved to at boot (MS-1). */
export type BoundClientKind = 'softDeleted' | 'scoped'

export interface ScopedShadowWindowCounts {
  sampled: number
  /** Clean framed comparisons — the counter exit criterion 2 reads (§7.2a). */
  observedFramed: number
  /** Excludes `unstableWindow` and `skewSuspect`; those are their own rows. */
  diverged: number
  unstableWindow: number
  skewSuspect: number
  /** `hadBusinessOnToken=true` on the HTTP path — a LOST frame. Gated at 0 (§6.3). */
  noContextHttpFrameLost: number
  /** `hadBusinessOnToken=false` — legitimately pre-business. Backlog, not a gate. */
  noContextHttpPreBusiness: number
  /** No Express request in scope — cron/webhook. Backlog (the `runUnscoped` work). */
  noContextJob: number
  shadowError: number
  /** Subset of `shadowError` where `errorName === 'ShadowProbeTimeout'`. Never summed. */
  timedOut: number
  unsupportedShape: number
  /** In-process (B-3): the sink's write REJECTED. A broken pipe — gates promotion. */
  sinkWriteFailed: number
  /** In-process (N-1): the inflight gauge was saturated. Benign backpressure. */
  sinkShed: number
  /** In-process: sampling refused by breaker/inflight rather than the dice roll. */
  throttled: number
}

/** One divergence row, redacted for transport. Ids here are already capped at 20 (B-6). */
export interface ScopedShadowRecentRow {
  kind: ShadowKind
  model: string
  operation: string
  /** `sha256(subjectBusinessId).slice(0,12)` — never the raw id (FM-13, AC-27). */
  businessIdHash: string | null
  unscopedCount: number
  scopedCount: number
  onlyUnscoped: string[]
  onlyScoped: string[]
  truncated: boolean
  suppressed: number
  /** `''` is mapped to `null` — an empty route hint means "no route", not "route ''". */
  routeHint: string | null
  provenance: ShadowProvenance
  hadBusinessOnToken: boolean
  hasInclude: boolean
  hasBoundedWindow: boolean
  observationIntervalMs: number
  errorName: string | null
  lastSeenAt: string
}

export interface ScopedShadowStatus {
  mode: 'off' | 'shadow' | 'enforce'
  /**
   * Mirrors the expression `prisma.ts` uses to pick the client. It is a re-read of
   * the same flag, so on its own it proves the flag parsed — not that the wiring
   * happened. `shadowPortInstalled` is the half that cannot be faked by a flag.
   */
  boundClient: BoundClientKind
  /** `getShadowPort() !== null` — real evidence for §3.1's second wiring line. */
  shadowPortInstalled: boolean
  configuredSample: number
  /** `configuredSample × throttleFactor` — what the sampler is actually using now. */
  effectiveSample: number
  breakerOpen: boolean
  /** FM-5 honesty flag: raw-SQL call sites are outside the extension's reach. */
  rawSqlSitesUnaudited: true
  canaryLastSeenAt: string | null
  /**
   * Fraction of in-window divergence rows carrying `include`. The diff compares
   * top-level ids only, so an `include` payload is NOT compared — this is how much
   * of the observed population the comparison was partly blind to. Denominator is
   * divergence rows, not samples: `hasInclude` is not carried on the stats table.
   */
  includeBlindFraction: number
  /** Exit criterion 2 (§11) — the A3 analogue. */
  distinctFramedRoutes: number
  windowHours: number
  windowCounts: ScopedShadowWindowCounts
  recent: ScopedShadowRecentRow[]
}
