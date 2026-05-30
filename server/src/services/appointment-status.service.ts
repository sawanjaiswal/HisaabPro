/**
 * Appointment status state machine.
 *
 * Uses a conditional `updateMany(where: { id, status: fromStatus })` so
 * concurrent PATCHes cannot both succeed — the second sees `count=0` and
 * fails with INVALID_STATUS_TRANSITION.
 *
 * Writes an `AppointmentStatusEvent` row in the same transaction.
 */

import type { AppointmentStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError, ErrorCode } from '../lib/errors.js'
import { STATUS_TRANSITIONS, APPT_ERR } from '../constants/appointment.constants.js'
import { conditionalStatusUpdate, findByIdInBusiness } from './appointment-repo.js'
import logger from '../lib/logger.js'

export function isValidTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

interface PatchInput {
  businessId: string
  actorUserId: string
  appointmentId: string
  toStatus: AppointmentStatus
  reason?: string | null
}

export async function patchAppointmentStatus(input: PatchInput) {
  const current = await findByIdInBusiness(input.businessId, input.appointmentId)
  if (!current) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Not found')

  const fromStatus = current.status
  if (fromStatus === input.toStatus) {
    // Idempotent no-op — return current row.
    return current
  }
  if (!isValidTransition(fromStatus, input.toStatus)) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      400,
      `Invalid status transition ${fromStatus} → ${input.toStatus}`,
      { code: APPT_ERR.INVALID_STATUS_TRANSITION, fromStatus, toStatus: input.toStatus }
    )
  }

  const updated = await prisma.$transaction(async (tx) => {
    const count = await conditionalStatusUpdate(
      tx,
      input.appointmentId,
      fromStatus,
      input.toStatus
    )
    if (count === 0) {
      throw new AppError(
        ErrorCode.CONFLICT,
        409,
        'Status changed concurrently — refetch and retry',
        { code: APPT_ERR.INVALID_STATUS_TRANSITION }
      )
    }
    await tx.appointmentStatusEvent.create({
      data: {
        appointmentId: input.appointmentId,
        fromStatus,
        toStatus: input.toStatus,
        reason: input.reason ?? null,
        actorUserId: input.actorUserId,
      },
    })
    return tx.appointment.findUniqueOrThrow({ where: { id: input.appointmentId } })
  })

  logger.info('[appointment] status patched', {
    appointmentId: input.appointmentId,
    fromStatus,
    toStatus: input.toStatus,
    actorUserId: input.actorUserId,
  })

  return updated
}
