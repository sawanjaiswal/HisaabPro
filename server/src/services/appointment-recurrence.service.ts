/**
 * Lightweight RRULE expansion — daily/weekly/monthly only, capped at
 * MAX_RECURRENCE_OCCURRENCES (52).
 *
 * Expansion is best-effort: any single occurrence that hits a slot conflict
 * is recorded in the result's `skipped` list and the rest continue. The
 * template row is always created first (so the FE has a stable parent id even
 * if every occurrence ends up skipped).
 */

import { prisma } from '../lib/prisma.js'
import type { AppointmentRecurrenceFreq } from '@prisma/client'
import { AppError, ErrorCode } from '../lib/errors.js'
import {
  MAX_RECURRENCE_OCCURRENCES,
  APPT_ERR,
} from '../constants/appointment.constants.js'
import { advanceByFreq, minutesBetween } from '../utils/appointment.utils.js'
import {
  resolveScopedParty,
  resolveScopedEmployee,
} from '../middleware/resolve-scoped.js'
import { insertAppointment, type AppointmentDetail } from './appointment-repo.js'
import logger from '../lib/logger.js'

interface ExpandInput {
  businessId: string
  userId: string
  partyId: string
  employeeId: string | null
  startAt: Date
  endAt: Date
  frequency: AppointmentRecurrenceFreq
  occurrences: number
  recurrenceEndAt: Date
  notes?: string | null
  serviceId?: string | null
  vertical: string
}

export interface ExpandResult {
  templateId: string
  created: AppointmentDetail[]
  skipped: Array<{ startAt: Date; reason: string }>
}

export async function expandRecurrence(input: ExpandInput): Promise<ExpandResult> {
  if (input.occurrences > MAX_RECURRENCE_OCCURRENCES) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      400,
      `Recurrence may not exceed ${MAX_RECURRENCE_OCCURRENCES} occurrences`,
      { code: APPT_ERR.RECURRENCE_TOO_LARGE }
    )
  }

  const party = await resolveScopedParty({ businessId: input.businessId }, input.partyId)
  const employee = input.employeeId
    ? await resolveScopedEmployee({ businessId: input.businessId }, input.employeeId)
    : null

  const template = await prisma.appointmentRecurrenceTemplate.create({
    data: {
      businessId: input.businessId,
      frequency: input.frequency,
      startAt: input.startAt,
      endAt: input.recurrenceEndAt,
      occurrences: input.occurrences,
    },
  })

  const created: AppointmentDetail[] = []
  const skipped: Array<{ startAt: Date; reason: string }> = []
  const durationMin = minutesBetween(input.startAt, input.endAt)

  let curStart = input.startAt
  let curEnd = input.endAt
  for (let i = 0; i < input.occurrences; i++) {
    if (curStart.getTime() > input.recurrenceEndAt.getTime()) break
    try {
      const row = await insertAppointment(prisma, {
        businessId: input.businessId,
        partyId: party.id,
        partyNameSnapshot: party.name,
        employeeId: employee?.id ?? null,
        employeeNameSnapshot: employee?.name ?? '',
        startAt: curStart,
        endAt: curEnd,
        durationMinutes: durationMin,
        vertical: input.vertical,
        notes: input.notes ?? null,
        serviceId: input.serviceId ?? null,
        idempotencyKey: null,
        createdById: input.userId,
        parentRecurrenceId: template.id,
      })
      created.push(row)
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 409) {
        skipped.push({ startAt: curStart, reason: APPT_ERR.SLOT_CONFLICT })
      } else {
        throw err
      }
    }
    curStart = advanceByFreq(curStart, input.frequency)
    curEnd = advanceByFreq(curEnd, input.frequency)
  }

  logger.info('[appointment] recurrence expanded', {
    templateId: template.id,
    createdCount: created.length,
    skippedCount: skipped.length,
    businessId: input.businessId,
  })

  return { templateId: template.id, created, skipped }
}
