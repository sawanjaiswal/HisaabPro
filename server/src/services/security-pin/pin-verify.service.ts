/**
 * PIN verify service — constant-time + lockout-aware orchestration.
 *
 * HP port of DH `auth-pin/pin-verify.service.ts` adapted to per-user model.
 *
 * Security contract (DO NOT change without security review):
 *   1. ALWAYS call comparePin(pin, hash) — never short-circuit on missing user
 *      or missing pinHash. When the user has no PIN set we compare against
 *      PIN_DUMMY_HASH so the bcrypt computation runs identically (constant
 *      timing prevents account-enumeration via response-time side channel).
 *   2. Lockout check runs BEFORE the bcrypt call (avoid burning CPU on a
 *      locked account; locked accounts get 429 not 401).
 *   3. On success we issue the pin_gate_grace cookie via PR1B's helper —
 *      `pf` (pin fingerprint) is derived from the same pinHash we just
 *      verified, so a subsequent PIN rotation invalidates this cookie via
 *      pf-mismatch without any session-table sweep (v2.3 design payoff).
 *   4. On wrong-PIN the failure counter is incremented atomically; the 5th
 *      wrong attempt flips the user into lockout for 30 min.
 *   5. PIN value MUST NOT appear in any log call.
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §18.4 row 71 (v2.3 — passes
 * pinHash into issuePinGraceCookie so cookie carries fresh pf).
 */

import type { Response } from 'express'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import { comparePin } from './pin-hash.util.js'
import {
  getLockState,
  assertNotLocked,
  registerFailure,
  resetCounters,
} from './pin-lockout.service.js'
import { issuePinGraceCookie, type RouteClass } from './pin-grace-cookie.js'
import { PIN_DUMMY_HASH } from '../../constants/pin-auth.constants.js'
import { createAuditEntry } from '../settings/audit.js'

export interface VerifyPinInput {
  userId: string
  businessId: string
  pin: string
  /** Cookie window class — defaults to 'mutation' for the verify endpoint. */
  routeClass?: RouteClass
  res: Response
}

export interface VerifyPinResult {
  success: true
}

/**
 * Verify a user's PIN. On success: resets failure counters, issues fresh
 * pin_gate_grace cookie on `res`, returns { success: true }.
 *
 * Failure modes (all throw AppError so asyncHandler → errorHandler maps them):
 *   - 429 RATE_LIMITED  — `PIN_LOCKED` — user is in active lockout window.
 *   - 401 UNAUTHORIZED  — `INVALID_PIN` — wrong PIN OR no PIN set OR no user.
 *                          (Single error so the response can't distinguish.)
 */
export async function verifyUserPin(input: VerifyPinInput): Promise<VerifyPinResult> {
  const { userId, businessId, pin, res } = input
  const routeClass: RouteClass = input.routeClass ?? 'mutation'

  // Step 1 — lockout pre-check (skip bcrypt if account is locked).
  const lockBefore = await getLockState(userId)
  assertNotLocked(lockBefore)

  // Step 2 — load current pinHash. May be null (user has not set a PIN, or
  // settings row doesn't exist). We do NOT branch on missing-ness here; the
  // dummy hash keeps the bcrypt path identical for the missing-user case.
  const settings = await prisma.userAppSettings.findUnique({
    where: { userId },
    select: { pinHash: true, pinEnabled: true },
  })

  const storedHash: string | null = settings?.pinHash ?? null
  const hashToCompare = storedHash ?? PIN_DUMMY_HASH

  // Step 3 — ALWAYS run comparePin (constant-time across all paths).
  const ok = comparePin(pin, hashToCompare)

  if (ok && storedHash !== null) {
    // Success — reset counters and issue cookie carrying the verified pinHash's
    // fingerprint. The cookie's `pf` is sha256(pinHash)[0..12]; on PIN rotation
    // pinHash changes → pf changes → this cookie 403s on the next gated route.
    // Audit row + resetCounters commit atomically; if either fails we don't
    // mint the grace cookie either.
    await prisma.$transaction(async (tx) => {
      await resetCounters(userId, tx)
      await createAuditEntry({
        businessId,
        entityType: 'UserAppSettings',
        entityId: userId,
        entityLabel: null,
        userId,
        action: 'PIN_VERIFY_SUCCESS',
        changes: { routeClass } as Record<string, unknown>,
      }, tx)
    })
    issuePinGraceCookie(res, userId, businessId, routeClass, storedHash)

    // SECURITY EVENT — verify_success.  We log via the standard structured logger
    // (security-events.ts only houses pin_gate.* tamper events). PII-safe: only
    // userId scalar; never the PIN itself.
    logger.info('pin_verify.success', { userId, businessId, routeClass })
    return { success: true }
  }

  // Failure branch — increment lockout counter. registerFailure is no-op when
  // no settings row exists, so a "no PIN set" caller still gets a 401 INVALID_PIN
  // without polluting another user's counter.  The failure-counter bump and
  // the audit row commit atomically inside one tx.
  const lockAfter = await prisma.$transaction(async (tx) => {
    const result = await registerFailure(userId, tx)
    await createAuditEntry({
      businessId,
      entityType: 'UserAppSettings',
      entityId: userId,
      entityLabel: null,
      userId,
      action: 'PIN_VERIFY_FAILURE',
      changes: { routeClass, lockoutTriggered: result.locked } as Record<string, unknown>,
    }, tx)
    return result
  })

  logger.warn('pin_verify.failure', {
    userId,
    businessId,
    routeClass,
    lockoutTriggered: lockAfter.locked,
  })

  if (lockAfter.locked) {
    throw new AppError(
      ErrorCode.RATE_LIMITED,
      429,
      'PIN locked. Try again after the cooldown.',
      { retryAfter: lockAfter.retryAfterSec ?? 0, lockedUntil: lockAfter.lockedUntil ?? null },
    )
  }

  throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'Invalid PIN', { reason: 'INVALID_PIN' })
}
