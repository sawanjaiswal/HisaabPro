/**
 * Kind classification (File #5, ARCHITECTURE §9.1).
 *
 * Pure: diff + arg flags + the observation interval in, one `ShadowKind` out.
 * No DB, no ALS, no clock — the interval is passed in precisely so this stays
 * testable against fixtures.
 *
 * The ordering below is the whole content of this module, and it is not
 * arbitrary. `clean` must be decided BEFORE the excuse kinds, or a bounded-window
 * read with no divergence at all would be filed as `unstable-window` and inflate
 * the very population the exit criteria excuse. Equally, the excuse kinds must be
 * decided before `diverged`, or a write landing mid-interval reads as a scoping
 * failure and the 72-hour zero-divergence gate never goes green on a live system.
 */
import { SHADOW_SKEW_MAX_IDS } from './prisma-shadow.constants.js'
import type { ShadowArgFlags, ShadowDiff, ShadowKind } from './prisma-shadow.types.js'

/**
 * True when the two sides agree.
 *
 * Both id arrays empty is NOT sufficient on its own: above `SHADOW_MAX_ROWS` the
 * diff degrades to a count-only comparison and returns empty arrays by design, so
 * counts must agree too. Checking arrays alone would report every oversized
 * divergence as clean — the exact false-negative shape this epic exists to rule
 * out.
 */
function isClean(diff: ShadowDiff): boolean {
  return (
    diff.onlyUnscoped.length === 0 &&
    diff.onlyScoped.length === 0 &&
    diff.unscopedCount === diff.scopedCount
  )
}

/**
 * Small, entirely one-directional divergence — the signature of a row written
 * between the control and the candidate (§9.1).
 *
 * Promise-reuse fixes the control first and the candidate second, so skew is
 * *systematic*, not random: an insert in the interval always surfaces as
 * `onlyScoped`, a delete always as `onlyUnscoped`. That determinism is what makes
 * "one-directional" a usable signal here. A genuine missing filter is
 * whole-tenant-shaped and reproducible; it does not present as one or two ids
 * moving in a single direction.
 *
 * This kind is reported and counted, never gated at zero — a hot write endpoint
 * produces it legitimately and forever.
 */
function isSkewSuspect(diff: ShadowDiff): boolean {
  const onlyUnscoped = diff.onlyUnscoped.length
  const onlyScoped = diff.onlyScoped.length
  const oneDirectional = onlyUnscoped === 0 || onlyScoped === 0
  const total = onlyUnscoped + onlyScoped
  return oneDirectional && total > 0 && total <= SHADOW_SKEW_MAX_IDS
}

export function classify(
  diff: ShadowDiff,
  argFlags: ShadowArgFlags,
  _observationIntervalMs: number,
): ShadowKind {
  // Not comparable at all — must outrank `clean`, since an id-less result set
  // diffs two empty arrays and is otherwise indistinguishable from agreement.
  if (diff.unsupportedShape) return 'unsupported-shape'

  if (isClean(diff)) return 'clean'

  // `take`/`skip`/`cursor`: the two sides read different windows of a moving list,
  // so a difference here carries no information about scoping.
  if (argFlags.hasBoundedWindow) return 'unstable-window'

  if (isSkewSuspect(diff)) return 'skew-suspect'

  return 'diverged'
}
