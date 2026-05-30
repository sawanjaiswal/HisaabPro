/**
 * Availability slot calculation.
 *
 * Generates a slot grid for a single day, subtracts active appointment ranges,
 * returns available `[startAt, endAt)` pairs.
 *
 * No business-hours metadata yet — caller passes the day range. A future
 * iteration consults `EmployeeWorkingHours` (deferred to a follow-up scope).
 */

import {
  resolveScopedEmployee,
} from '../middleware/resolve-scoped.js'
import {
  generateSlotGrid,
  filterAvailableSlots,
  startOfDayUTC,
  endOfDayUTC,
} from '../utils/appointment.utils.js'
import { findOverlapsInRange } from './appointment-repo.js'

interface Scope {
  businessId: string
}

interface AvailabilityRequest {
  employeeId: string
  date: Date
  serviceDurationMinutes: number
  stepMinutes?: number
}

export async function getAvailability(
  scope: Scope,
  req: AvailabilityRequest
): Promise<{ slots: Array<{ startAt: Date; endAt: Date }> }> {
  await resolveScopedEmployee(scope, req.employeeId)
  const dayStart = startOfDayUTC(req.date)
  const dayEnd = endOfDayUTC(req.date)
  const step = req.stepMinutes ?? 15

  const grid = generateSlotGrid(dayStart, dayEnd, req.serviceDurationMinutes, step)
  const busy = await findOverlapsInRange(scope.businessId, req.employeeId, dayStart, dayEnd)
  const slots = filterAvailableSlots(grid, busy)
  return { slots }
}
