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
