/**
 * PIN lockout service — per-user lockout on UserAppSettings.
 *
 * HP adaptation of DH `auth-pin/pin-lockout.service.ts`. DH uses per-device
 * (UserDevicePin) + per-phone (PinPhoneLockout) — HP has neither table.
 * Instead we use the columns already on `UserAppSettings`:
 *   - pinAttempts:    Int    @default(0)   (DH: attemptCount)
 *   - pinLockedUntil: DateTime?            (DH: lockedUntil)
 *
 * Semantics:
 *   - 5th consecutive wrong PIN → pinLockedUntil = now + 30 min, attempts → 0.
 *   - getLockState  — read-only check; returns { locked, retryAfter? }.
 *   - registerFailure — atomic increment; flips lockedUntil when threshold hit.
 *   - resetCounters — clears both columns on successful verify or PIN rotation.
 *
 * Race safety: the increment uses Prisma's atomic `{ increment: 1 }` op so
 * two parallel wrong-PIN requests can't double-count. The "flip to locked"
 * step reads the post-increment value and only writes the lockedUntil if it
 * just hit the threshold — a third parallel request that sees the row
 * already-locked is a no-op (idempotent).
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §18.4 row 72.
 */

import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import {
  PIN_MAX_ATTEMPTS,
  PIN_LOCKOUT_MS,
} from '../../constants/pin-auth.constants.js'

/**
 * Prisma client OR a tx callback client — same model fluent API.
 * Mirrors the SSOT pattern used by `services/gst-settings.service.ts`
 * and `services/custom-order/helpers.ts`.
 */
type PrismaLike = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export interface LockState {
  /** True when the user's account is currently in lockout. */
  locked: boolean
  /** Seconds until lockout expires (only meaningful when locked=true). */
  retryAfterSec?: number
  /** Absolute lockout expiry (mirrors UserAppSettings.pinLockedUntil). */
  lockedUntil?: Date
}

/**
 * Read-only lock state check. Called at the top of pin-verify so we can
 * 429 BEFORE running bcrypt — avoids burning CPU on a locked account.
 */
export async function getLockState(userId: string): Promise<LockState> {
  const settings = await prisma.userAppSettings.findUnique({
    where: { userId },
    select: { pinLockedUntil: true },
  })

  const now = new Date()
  if (!settings?.pinLockedUntil || settings.pinLockedUntil <= now) {
    return { locked: false }
  }

  const retryAfterSec = Math.ceil((settings.pinLockedUntil.getTime() - now.getTime()) / 1000)
  return { locked: true, lockedUntil: settings.pinLockedUntil, retryAfterSec }
}

/**
 * Throws AppError(RATE_LIMITED, 429, 'PIN_LOCKED') if locked. Called at the
 * top of pin-verify after `getLockState` returns locked=true.
 */
export function assertNotLocked(state: LockState): void {
  if (!state.locked) return
  throw new AppError(
    ErrorCode.RATE_LIMITED,
    429,
    'PIN locked. Try again after the cooldown.',
    { retryAfter: state.retryAfterSec ?? 0, lockedUntil: state.lockedUntil ?? null },
  )
}

/**
 * Atomic failure-counter bump. Returns the new lock state — caller maps to
 * 401 INVALID_PIN (when still not locked) or 429 PIN_LOCKED (when just locked).
 *
 * Step 1 — atomic `increment: 1` on pinAttempts (no clobber under concurrency).
 * Step 2 — if post-increment value ≥ threshold, write `pinLockedUntil` and
 *          reset attempts to 0 (a fresh lockout window).
 *
 * If no UserAppSettings row exists (user has never opened settings) we no-op
 * — there's no PIN to fail against, so no counter to bump.
 */
export async function registerFailure(
  userId: string,
  client: PrismaLike = prisma,
): Promise<LockState> {
  const settings = await client.userAppSettings.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!settings) return { locked: false }

  const updated = await client.userAppSettings.update({
    where: { userId },
    data: { pinAttempts: { increment: 1 } },
    select: { pinAttempts: true },
  })

  if (updated.pinAttempts >= PIN_MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + PIN_LOCKOUT_MS)
    await client.userAppSettings.update({
      where: { userId },
      data: { pinAttempts: 0, pinLockedUntil: lockedUntil },
    })
    const retryAfterSec = Math.ceil(PIN_LOCKOUT_MS / 1000)
    return { locked: true, lockedUntil, retryAfterSec }
  }

  return { locked: false }
}

/**
 * Reset on successful verify OR on PIN rotation. Clears both pinAttempts and
 * pinLockedUntil. Idempotent — safe to call when nothing needs clearing.
 *
 * Skips the write when no settings row exists (avoids P2025 on first-time PIN
 * setters). Caller of pin-set is responsible for ensuring the row exists
 * before calling this.
 */
export async function resetCounters(
  userId: string,
  client: PrismaLike = prisma,
): Promise<void> {
  const settings = await client.userAppSettings.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!settings) return

  await client.userAppSettings.update({
    where: { userId },
    data: { pinAttempts: 0, pinLockedUntil: null },
  })
}
