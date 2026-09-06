/**
 * Charge-ladder math — PURE, no I/O.
 *
 * Everything is derived from the subscription row's currentPeriodEnd (E).
 */

import {
  attemptCallOffsetDays,
  GRACE_DAYS,
  MAX_ATTEMPTS,
} from './token-engine.constants.js'

const DAY_MS = 24 * 60 * 60 * 1000

export function cycleKeyFor(currentPeriodEnd: Date): string {
  return `cyc_${currentPeriodEnd.toISOString().replace(/\.\d{3}Z$/, 'Z')}`
}

export function attemptCallAt(currentPeriodEnd: Date, attemptNo: number): Date {
  return new Date(currentPeriodEnd.getTime() + attemptCallOffsetDays(attemptNo) * DAY_MS)
}

export function graceEndFor(currentPeriodEnd: Date): Date {
  return new Date(currentPeriodEnd.getTime() + GRACE_DAYS * DAY_MS)
}

export function nextAttemptAfterFailure(
  currentPeriodEnd: Date,
  failedAttemptNo: number,
): { attemptNo: number; callAt: Date } | null {
  if (failedAttemptNo >= MAX_ATTEMPTS) return null
  const attemptNo = failedAttemptNo + 1
  return { attemptNo, callAt: attemptCallAt(currentPeriodEnd, attemptNo) }
}

export function firstAttemptCallAt(currentPeriodEnd: Date): Date {
  return attemptCallAt(currentPeriodEnd, 1)
}
