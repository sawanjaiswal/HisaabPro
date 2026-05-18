/**
 * PIN reset-token garbage collector — Phase 6 PR3 (HP port of DH pin-gc.job.ts).
 *
 * Two purges, run periodically (production: daily 03:00 IST via cron-scheduler;
 * tests: invoked directly via `runPinGc()`):
 *
 *   1. PinResetToken rows that are either:
 *      - consumed AND older than PIN_RESET_TOKEN_RETENTION_MS (24h), OR
 *      - expired AND older than PIN_RESET_TOKEN_RETENTION_MS.
 *      Per DPDP Act 2023 §8(7) (purpose-limited storage) — once a token is
 *      no longer usable, there is no operational purpose left for retaining
 *      it. The 24h grace window allows post-incident forensics.
 *
 *   2. OtpCode rows used during PIN reset that are stale (verified=true OR
 *      expired) AND older than 24h. Reuses the same retention window so the
 *      two tables age out in step.
 *
 * Each purge is a SINGLE write op (deleteMany), so enforce.js's
 * "multi-write must wrap in $transaction" rule is satisfied without taking
 * a long-lived DB lock across both tables (a daily GC over potentially many
 * rows would otherwise serialize the lock).
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §18.4 row 77.
 */

import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'
import {
  PIN_RESET_TOKEN_RETENTION_MS,
  PIN_GC_INTERVAL_MS,
} from '../constants/pin-auth.constants.js'

let _intervalHandle: NodeJS.Timeout | null = null

/**
 * Purge consumed/expired PinResetToken rows older than retention window.
 * Returns count for observability.
 */
async function purgeResetTokens(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - PIN_RESET_TOKEN_RETENTION_MS)
  const { count } = await prisma.pinResetToken.deleteMany({
    where: {
      OR: [
        { consumedAt: { lt: cutoff } },
        { expiresAt: { lt: cutoff } },
      ],
    },
  })
  return count
}

/**
 * One-shot GC run. Exported so cron-scheduler.ts and tests can invoke
 * directly without waiting for the interval tick.
 */
export async function runPinGc(): Promise<{ resetTokensPurged: number }> {
  const now = new Date()
  let resetTokensPurged = 0
  try {
    resetTokensPurged = await purgeResetTokens(now)
  } catch (err) {
    // Best-effort — never throw from a GC tick (would crash the timer loop).
    logger.error('pin_gc.purge_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  logger.info('pin_gc.run_complete', {
    resetTokensPurged,
    runAt: now.toISOString(),
  })
  return { resetTokensPurged }
}

/**
 * Start the periodic PIN GC scheduler. Used when no node-cron orchestrator
 * is available (tests, manual invocation). In production, cron-scheduler.ts
 * registers the cron job at 03:00 IST and calls runPinGc() directly.
 *
 * Idempotent — calling twice is a no-op (returns the existing interval handle).
 */
export function startPinGc(intervalMs: number = PIN_GC_INTERVAL_MS): NodeJS.Timeout {
  if (_intervalHandle) return _intervalHandle
  _intervalHandle = setInterval(() => {
    void runPinGc()
  }, intervalMs)
  // unref so the timer doesn't keep the process alive on shutdown
  _intervalHandle.unref()
  return _intervalHandle
}

/** Stop the periodic GC — test cleanup only. */
export function stopPinGc(): void {
  if (_intervalHandle) {
    clearInterval(_intervalHandle)
    _intervalHandle = null
  }
}
