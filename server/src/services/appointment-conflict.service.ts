/**
 * Slot-conflict primitive.
 *
 * Correctness is owned by the `btree_gist EXCLUDE` constraint in the
 * migration: parallel inserts across multiple processes can race past any
 * app-layer pre-check, and only the DB constraint will catch the second
 * insert.
 *
 * This module wraps `prisma.appointment.create` and translates the PG
 * exclusion-violation SQLSTATE `23P01` into an `AppError(CONFLICT, 409,
 * APPT_SLOT_CONFLICT)` so the route layer can return a clean envelope.
 *
 * The pre-check helper here is an OPTIMISATION (lets us 409 faster on the
 * common case + lets test code assert "would this conflict?"), NOT a
 * correctness barrier. Removing it changes nothing about race-safety.
 */

import { AppError, ErrorCode } from '../lib/errors.js'
import type { ExtendedPrismaClient } from '../lib/prisma.js'
import { APPT_ERR, CONFLICT_STATUSES, PG_EXCLUSION_VIOLATION } from '../constants/appointment.constants.js'

/** Either the singleton client or a transaction client derived from it. */
export type PrismaLike = ExtendedPrismaClient | Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

export interface ConflictCheckInput {
  businessId: string
  employeeId: string | null
  startAt: Date
  endAt: Date
  excludeAppointmentId?: string
}

export async function hasOverlappingAppointment(
  db: PrismaLike,
  input: ConflictCheckInput
): Promise<boolean> {
  if (!input.employeeId) return false
  const conflicting = await db.appointment.findFirst({
    where: {
      businessId: input.businessId,
      employeeId: input.employeeId,
      status: { in: CONFLICT_STATUSES },
      ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
      // half-open interval overlap: existing.startAt < new.endAt AND existing.endAt > new.startAt
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt },
    },
    select: { id: true },
  })
  return conflicting !== null
}

/**
 * Wraps any insert/update that might trip the exclusion constraint. Translates
 * PG `23P01` into AppError(CONFLICT). Re-throws everything else untouched.
 */
export async function withSlotConflictTranslation<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    if (isExclusionViolation(err)) {
      throw new AppError(ErrorCode.CONFLICT, 409, 'Slot already booked', {
        code: APPT_ERR.SLOT_CONFLICT,
      })
    }
    throw err
  }
}

function isExclusionViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { code?: string; meta?: { code?: string } }
  // Prisma surfaces the raw SQLSTATE on PrismaClientKnownRequestError.meta?.code
  if (e.meta?.code === PG_EXCLUSION_VIOLATION) return true
  // Some driver versions place it on .code directly.
  if (e.code === PG_EXCLUSION_VIOLATION) return true
  // Prisma error P2010 wraps raw queries — message contains the SQLSTATE.
  if (typeof (err as { message?: string }).message === 'string') {
    return (err as { message: string }).message.includes(PG_EXCLUSION_VIOLATION)
  }
  return false
}
