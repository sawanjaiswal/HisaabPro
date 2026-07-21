/**
 * Shadow-harness constants (File #3, ARCHITECTURE §4.2, §9.3).
 *
 * Values only — no logic. The one piece of derivation here is `SHADOW_READ_OPS`,
 * and it is deliberately a SUBTRACTION over imported sets rather than a re-typed
 * list, so an op added upstream cannot silently diverge from the injector's view
 * of what a read is.
 */
import { READ_MERGE_OPS, FIND_UNIQUE_OPS } from './prisma-scoped.rewrite.js'

/**
 * Ops whose results cannot be compared row-by-row. Excluded by subtraction.
 *
 * FM-16: this exclusion is the safety mechanism most likely to cause the silent
 * death it exists to prevent — exclude too much and the harness samples nothing
 * while reporting healthy. `count`/`aggregate`/`groupBy` return scalars, not
 * rows, so there is nothing to diff; everything else stays in.
 */
export const SHADOW_UNCOMPARABLE_OPS: ReadonlySet<string> = new Set([
  'count',
  'aggregate',
  'groupBy',
])

/**
 * The ops the harness will shadow: (READ_MERGE_OPS ∪ FIND_UNIQUE_OPS) minus the
 * uncomparable ones = findFirst, findFirstOrThrow, findMany, findUnique,
 * findUniqueOrThrow.
 *
 * A future read op added upstream lands here automatically **in the included
 * position**. That is the correct default only because A10 enumerates every
 * Prisma op against a spy delegate and fails on any newly-sampled op with no
 * comparator — the constant is safe because of the test, not on its own.
 */
export const SHADOW_READ_OPS: ReadonlySet<string> = new Set(
  [...READ_MERGE_OPS, ...FIND_UNIQUE_OPS].filter((op) => !SHADOW_UNCOMPARABLE_OPS.has(op)),
)

/**
 * Persistence cap on each id array (§9.3 control 1, SCOPE:244-245).
 *
 * NOT the same quantity as `SHADOW_MAX_ROWS`. This one bounds how many ids are
 * durably stored — the divergence table is a cross-tenant identifier-linkage
 * store, and a whole-tenant-shaped divergence would otherwise persist every id
 * it touched. `unscopedCount`/`scopedCount` preserve the magnitude and
 * `truncated` records that the cap bit, so nothing diagnostic is lost.
 */
export const SHADOW_MAX_IDS = 20

/** Comparison ceiling: above this, compare counts only and set `truncated`. */
export const SHADOW_MAX_ROWS = 5000

/** The probe loses the race past this and is recorded as `shadow-error`. */
export const SHADOW_TIMEOUT_MS = 250

/** Concurrent probe queries. Pool is 10; probe + sink together stay ≤ 4. */
export const SHADOW_MAX_INFLIGHT = 2

/** Concurrent sink writes (B-2). Sheds rather than queues when saturated. */
export const SHADOW_SINK_MAX_INFLIGHT = 2

/** Breaker: this many probe-or-sink errors inside the window trips it. */
export const SHADOW_BREAKER_ERRORS = 20
export const SHADOW_BREAKER_WINDOW_MS = 60_000
export const SHADOW_BREAKER_COOLDOWN_MS = 300_000

/**
 * Latency the probe is expected to stay under. Above it the EWMA arm decays
 * `throttleFactor`; below half of it, the factor recovers. Deliberately well
 * under `SHADOW_TIMEOUT_MS` — backing off at the timeout would mean the harness
 * only reacts once it is already losing races (FM-10).
 */
export const SHADOW_LATENCY_TARGET_MS = 120

/** EWMA smoothing. Low enough that one slow probe cannot collapse the factor. */
export const SHADOW_LATENCY_ALPHA = 0.2

/** Multiplicative decrease / additive increase on `throttleFactor`. */
export const SHADOW_THROTTLE_DECAY = 0.5
export const SHADOW_THROTTLE_RECOVER = 0.1

/** Factor the harness resumes at after a breaker cooldown, never full rate. */
export const SHADOW_THROTTLE_RESUME = 0.1

/** Distinct dedupe-key inserts per hour before the sink sheds (FM-11). */
export const SHADOW_MAX_KEYS_PER_HOUR = 5000

/**
 * A diff at or below this size, entirely in one direction, seen inside the
 * observation interval, is more likely write skew than a missing filter (§9.1).
 */
export const SHADOW_SKEW_MAX_IDS = 3

// ── Phase 5 · jobs ──────────────────────────────────────────────────────────

/**
 * Retention, ceiling 1 (§7.4, D-14). Deletes on `lastSeenAt`, NOT `createdAt`:
 * the dedupe upsert pins `createdAt` at first-sight, so an age-on-createdAt rule
 * would delete the hottest still-firing divergence in the system on day 31.
 */
export const SHADOW_RETENTION_LAST_SEEN_DAYS = 30

/**
 * Retention, ceiling 2 (M-5, D-14). `lastSeenAt`-only retention means a
 * continuously-firing row is NEVER deleted, and a row holding up to 20 ids
 * belonging to other tenants is an indefinitely-retained cross-tenant identifier
 * linkage — a DPDP erasure problem, not a bloat problem (§9.3). A row still
 * firing at day 180 has been an open incident for six months; the next
 * occurrence re-creates it with a fresh `createdAt`.
 */
export const SHADOW_RETENTION_ABSOLUTE_DAYS = 180

/** `ScopedShadowStat` holds counters and no identifiers at all — one rule. */
export const SHADOW_STAT_RETENTION_DAYS = 180

/**
 * Per-tick delete cap. A single unbounded `deleteMany` over a bloated table takes
 * a long row-level lock on the table the cutover decision reads. The cron is
 * daily and idempotent, so a backlog drains over consecutive nights instead of
 * in one lock.
 */
export const SHADOW_RETENTION_MAX_DELETES = 5_000

/**
 * The exit-criteria window (§11). Every exit query runs over `lastSeenAt` inside
 * this many days, which is what makes it DISJOINT from the retention predicate by
 * construction: a row that fired during the window cannot also satisfy
 * `lastSeenAt < 30d`. C4 turns that arithmetic into a boot assertion
 * (`lib/boot-guards.ts`) so a future config edit cannot silently end it.
 */
export const SHADOW_WATCH_WINDOW_DAYS = 7

/**
 * C4 — the disjointness margin the boot assertion enforces:
 * `SHADOW_RETENTION_LAST_SEEN_DAYS >= RATIO * SHADOW_WATCH_WINDOW_DAYS`.
 */
export const SHADOW_RETENTION_WINDOW_RATIO = 4

/** Watchdog: how far back durable activity counts as "a watch is in progress". */
export const SHADOW_WATCHDOG_ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000

/** Canary cadence and the age past which its absence pages (AC-18). */
export const SHADOW_CANARY_INTERVAL_MIN = 15
export const SHADOW_CANARY_MAX_AGE_MS = 45 * 60 * 1000

/**
 * The bounded synthetic canary fixture (D-15, §9.3 control 4).
 *
 * SCOPE:413-416 specified the canary as an unbounded `findMany` with no tenant
 * predicate. That form returns other tenants' rows BY DESIGN and would persist a
 * 20-id sample of real production ids every 15 minutes, forever, as its steady
 * state — making the positive control itself the largest recurring source of the
 * cross-tenant linkage the whole §9.3 section exists to bound.
 *
 * These two ids are seeded, synthetic, and fixed: `SELF` belongs to the canary
 * business, `FOREIGN` to a second synthetic business. A scoped read of both ids
 * under the canary frame must return exactly `[SELF]`. The control fails just as
 * loudly as the unbounded form — it simply cannot manufacture linkage while
 * doing so, because neither id names a real tenant's row.
 */
export const SHADOW_CANARY_MODEL = 'Party'
export const SHADOW_CANARY_SELF_ID = 'shadow-canary-fixture-self'
export const SHADOW_CANARY_FOREIGN_ID = 'shadow-canary-fixture-foreign'
export const CANARY_FIXTURE_IDS: readonly string[] = [
  SHADOW_CANARY_SELF_ID,
  SHADOW_CANARY_FOREIGN_ID,
]
