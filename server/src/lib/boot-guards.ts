/**
 * Boot guards (File #35, ARCHITECTURE §15.3 SR-3 + §19 risk 5 / C4).
 *
 * One place that runs every "refuse to boot" check, called from `index.ts`.
 *
 * SR-3 is why this file exists: `validateScopedPrismaBoot()` was written, was
 * correct, typechecked, and had ZERO call sites. A boot guard nobody calls is the
 * same landed-dark shape this whole epic was opened to remove — it reads as a
 * control in review and is inert at runtime. Adoption assertion A4 spawns a real
 * process to prove the guard actually refuses the boot.
 *
 * C4 is the second check, and it guards a constant, not a code path. Retention
 * deletes on `lastSeenAt < 30d`; every exit query runs over a 7-day `lastSeenAt`
 * window. Those two sets are disjoint BY CONSTRUCTION — a row that fired during
 * the window cannot satisfy the delete predicate — so the retention cron cannot
 * empty the table the cutover decision reads. The exposure is not the arithmetic;
 * it is a later edit to it. Once File #50 puts 30/180 into `render.yaml` as env
 * knobs, someone trimming retention to 1 day during a disk-pressure incident ends
 * disjointness silently, and `diverged = 0` starts reading clean for a reason
 * unrelated to the code. Asserting it here turns that config edit into a failed
 * deploy, which is a control; "listed in the design plan" is not (§19 risk 4).
 */

import { validateNicEnv } from './env.js'
import { getScopedPrismaMode, validateScopedPrismaBoot } from './env.scoped-prisma.js'
import {
  SHADOW_RETENTION_LAST_SEEN_DAYS,
  SHADOW_RETENTION_WINDOW_RATIO,
  SHADOW_WATCH_WINDOW_DAYS,
} from './prisma-shadow.constants.js'
import { createShadowStats } from './prisma-shadow.stats.js'
import { prisma } from './prisma.js'
import logger from './logger.js'
import type { ShadowDb } from './prisma-shadow.types.js'

export class ShadowRetentionWindowError extends Error {
  constructor(retentionDays: number, windowDays: number) {
    super(
      `FATAL: shadow retention (${retentionDays}d) must be >= ${SHADOW_RETENTION_WINDOW_RATIO}x the ` +
        `watch window (${windowDays}d). Below that, the retention cron can delete rows the exit ` +
        `criteria are still reading, and "diverged = 0" stops meaning "no divergence".`,
    )
    this.name = 'ShadowRetentionWindowError'
  }
}

/** C4 — disjointness as an assertion instead of a paragraph. */
export function assertShadowRetentionWindow(): void {
  if (SHADOW_RETENTION_LAST_SEEN_DAYS < SHADOW_RETENTION_WINDOW_RATIO * SHADOW_WATCH_WINDOW_DAYS) {
    throw new ShadowRetentionWindowError(SHADOW_RETENTION_LAST_SEEN_DAYS, SHADOW_WATCH_WINDOW_DAYS)
  }
}

/**
 * Arm the watchdog from minute one (§15.1).
 *
 * The watchdog infers "a watch is in progress" from durable stat rows, so under
 * `shadow` it would otherwise stay idle until the first sampled query — a window
 * in which a harness that never samples at all looks exactly like a healthy one
 * before traffic. Fire-and-forget: a stat write must never be able to stop the
 * API from booting.
 */
function armWatchdog(): void {
  void createShadowStats({ db: prisma as unknown as ShadowDb })
    .bump(['watch-active'])
    .catch((e: unknown) =>
      logger.error('boot.watch_active_stat_failed', {
        error: e instanceof Error ? e.message : String(e),
      }),
    )
}

/** Every boot-time refusal, in one call. Throws to abort the boot. */
export function runBootGuards(): void {
  // MB-5: NIC_ENV=prod with NODE_ENV !== production
  validateNicEnv()
  // M3: post-cutover production must run `enforce`, and any garbage value fails
  validateScopedPrismaBoot()
  // C4: the retention/watch-window precondition
  assertShadowRetentionWindow()

  if (getScopedPrismaMode() === 'shadow') armWatchdog()
}
