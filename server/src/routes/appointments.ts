/**
 * /api/appointments — authenticated CRUD + status state machine + availability.
 *
 * Middleware chain (architecture §5):
 *   auth → requireActiveBusiness → requireFeature('V2_APPOINTMENTS')
 *     → (per-route) validate → handler
 *
 * Cross-tenant: every client-supplied ID (partyId/employeeId/appointmentId)
 * is resolved through `resolveScoped*` helpers BEFORE any further query;
 * mismatches return 404 (NEVER 403).
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { createRateLimiter } from '../middleware/rate-limit.js'
import { sendSuccess } from '../lib/response.js'
import {
  createAppointmentSchema,
  patchStatusSchema,
  availabilityQuerySchema,
  type CreateAppointmentBody,
  type PatchStatusBody,
} from '../schemas/appointment.schema.js'
import { createAppointment, getAppointment, listAppointments } from '../services/appointment.service.js'
import { patchAppointmentStatus } from '../services/appointment-status.service.js'
import { getAvailability } from '../services/appointment-availability.service.js'
import { expandRecurrence } from '../services/appointment-recurrence.service.js'
import { AVAILABILITY_USER_RATE_LIMIT_PER_MIN } from '../constants/appointment.constants.js'

const router = Router()

const availabilityLimiter = createRateLimiter({
  windowMs: 60_000,
  max: AVAILABILITY_USER_RATE_LIMIT_PER_MIN,
  message: 'Too many availability requests',
  keyFn: (req) => `rl:appt-avail:${req.user?.userId ?? req.ip ?? 'unknown'}`,
})

router.use(auth)

/**
 * GET /api/appointments?from=&to=&employeeId=
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const from = new Date(String(req.query.from ?? new Date().toISOString()))
    const to = new Date(String(req.query.to ?? new Date(Date.now() + 7 * 86400e3).toISOString()))
    const employeeId = req.query.employeeId ? String(req.query.employeeId) : undefined
    const rows = await listAppointments({ businessId, userId }, { from, to, employeeId })
    sendSuccess(res, rows)
  })
)

/**
 * POST /api/appointments — create (optionally recurring).
 */
router.post(
  '/',
  validate(createAppointmentSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const body = req.body as CreateAppointmentBody

    if (body.recurrence) {
      const result = await expandRecurrence({
        businessId,
        userId,
        partyId: body.partyId,
        employeeId: body.employeeId,
        startAt: body.startAt,
        endAt: body.endAt,
        frequency: body.recurrence.frequency,
        occurrences: body.recurrence.occurrences,
        recurrenceEndAt: body.recurrence.endAt,
        notes: body.notes ?? null,
        serviceId: body.serviceId ?? null,
        vertical: 'general',
      })
      sendSuccess(res, result, 201)
      return
    }

    const created = await createAppointment(
      { businessId, userId },
      {
        partyId: body.partyId,
        employeeId: body.employeeId,
        startAt: body.startAt,
        endAt: body.endAt,
        notes: body.notes ?? null,
        serviceId: body.serviceId ?? null,
        idempotencyKey: body.idempotencyKey,
      }
    )
    sendSuccess(res, created, 201)
  })
)

/**
 * GET /api/appointments/availability — 120/min/user.
 * MUST come before /:id so the literal path wins over the param route.
 */
router.get(
  '/availability',
  availabilityLimiter,
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const parsed = availabilityQuerySchema.parse(req.query)
    const result = await getAvailability({ businessId }, parsed)
    sendSuccess(res, result)
  })
)

/**
 * GET /api/appointments/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const id = String(req.params.id)
    const row = await getAppointment({ businessId, userId }, id)
    sendSuccess(res, row)
  })
)

/**
 * PATCH /api/appointments/:id/status
 */
router.patch(
  '/:id/status',
  validate(patchStatusSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const body = req.body as PatchStatusBody
    const id = String(req.params.id)
    const updated = await patchAppointmentStatus({
      businessId,
      actorUserId: userId,
      appointmentId: id,
      toStatus: body.toStatus,
      reason: body.reason ?? null,
    })
    sendSuccess(res, updated)
  })
)

export default router
