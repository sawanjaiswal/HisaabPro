/**
 * Public booking endpoints — HMAC-gated, no auth cookies.
 *
 * Security invariants:
 *   - 30 req/min/IP rate limit.
 *   - NEVER include PII in 404/409 envelopes (the booker is anonymous and
 *     may share the URL — leaking party names or business details would be a
 *     PII regression).
 *   - Token verify order: parse → load business + secret → SharedLink revoked
 *     check (delegated to verifyPublicBookingToken caller) → timingSafeEqual
 *     HMAC → expiresAt > now.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { createRateLimiter } from '../middleware/rate-limit.js'
import { sendSuccess, sendError } from '../lib/response.js'
import {
  publicBookingCreateSchema,
  publicBookingAvailabilitySchema,
  type PublicBookingCreateBody,
} from '../schemas/appointment-public-booking.schema.js'
import { verifyPublicBookingToken } from '../services/public-booking-signature.js'
import { getAvailability } from '../services/appointment-availability.service.js'
import { insertAppointment } from '../services/appointment-repo.js'
import { minutesBetween } from '../utils/appointment.utils.js'
import { AppError, ErrorCode } from '../lib/errors.js'
import { PUBLIC_BOOKING_RATE_LIMIT_PER_MIN, APPT_ERR } from '../constants/appointment.constants.js'
import logger from '../lib/logger.js'

const router = Router()

const publicBookingLimiter = createRateLimiter({
  windowMs: 60_000,
  max: PUBLIC_BOOKING_RATE_LIMIT_PER_MIN,
  message: 'Too many booking attempts',
  keyFn: (req) => `rl:public-booking:${req.ip ?? 'unknown'}`,
  eventName: 'public_booking_rate_limited',
})

router.use(publicBookingLimiter)

/**
 * POST /api/p/booking/availability — anonymous availability lookup.
 * The token's businessId + employeeId scope the lookup.
 */
router.post(
  '/availability',
  validate(publicBookingAvailabilitySchema),
  asyncHandler(async (req, res) => {
    const parsed = req.body as { token: string; date: Date; durationMinutes: number; stepMinutes?: number }
    let verifyResult: Awaited<ReturnType<typeof verifyPublicBookingToken>>
    try {
      verifyResult = await verifyPublicBookingToken(parsed.token)
    } catch (err) {
      // No PII in body — opaque envelope.
      sendError(res, 'Invalid or expired link', APPT_ERR.PUBLIC_BOOKING_INVALID, 401)
      return
    }
    const { businessId, employeeId } = verifyResult.payload
    if (!employeeId) {
      sendError(res, 'This link does not target a specific staff member', APPT_ERR.PUBLIC_BOOKING_INVALID, 400)
      return
    }
    const result = await getAvailability(
      { businessId },
      {
        employeeId,
        date: parsed.date,
        serviceDurationMinutes: parsed.durationMinutes,
        stepMinutes: parsed.stepMinutes,
      }
    )
    sendSuccess(res, result)
  })
)

/**
 * POST /api/p/booking — anonymous create.
 *
 * The booker supplies a name + phone. We create or reuse a `Party` row in the
 * target business by phone lookup; this is the only DB write outside the
 * appointment insert itself.
 */
router.post(
  '/',
  validate(publicBookingCreateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as PublicBookingCreateBody
    let verifyResult: Awaited<ReturnType<typeof verifyPublicBookingToken>>
    try {
      verifyResult = await verifyPublicBookingToken(body.token)
    } catch (err) {
      sendError(res, 'Invalid or expired link', APPT_ERR.PUBLIC_BOOKING_INVALID, 401)
      return
    }
    const { businessId, employeeId } = verifyResult.payload

    // We intentionally DO NOT echo back the resolved party/employee names.
    // The anonymous client only needs to know whether the booking succeeded.
    try {
      const created = await createAnonymousBooking({
        businessId,
        employeeId,
        partyName: body.partyName,
        partyPhone: body.partyPhone,
        startAt: body.startAt,
        durationMinutes: body.durationMinutes,
        notes: body.notes ?? null,
        idempotencyKey: body.idempotencyKey,
      })
      sendSuccess(res, { id: created.id, startAt: created.startAt }, 201)
    } catch (err) {
      if (err instanceof AppError) {
        // 409 → slot conflict (no PII); 404 → opaque "Invalid link" rewrite.
        if (err.statusCode === 409) {
          sendError(res, 'Slot no longer available', APPT_ERR.SLOT_CONFLICT, 409)
          return
        }
        if (err.statusCode === 404) {
          sendError(res, 'Invalid or expired link', APPT_ERR.PUBLIC_BOOKING_INVALID, 401)
          return
        }
      }
      throw err
    }
  })
)

/**
 * Minimal anonymous-create primitive. Reuses the appointment-repo insert so
 * slot-conflict translation stays consistent. Party is created/looked-up by
 * phone within the target business — we never accept a partyId from the
 * anonymous client.
 */
async function createAnonymousBooking(input: {
  businessId: string
  employeeId: string | null
  partyName: string
  partyPhone: string
  startAt: Date
  durationMinutes: number
  notes: string | null
  idempotencyKey: string
}) {
  const { prisma } = await import('../lib/prisma.js')

  // Upsert party by phone scoped to business.
  const party = await prisma.party.upsert({
    where: {
      businessId_phone: { businessId: input.businessId, phone: input.partyPhone },
    },
    create: {
      businessId: input.businessId,
      name: input.partyName,
      phone: input.partyPhone,
      type: 'CUSTOMER',
    },
    update: {},
    select: { id: true, name: true },
  })

  const employeeName = input.employeeId
    ? (await prisma.employee.findFirst({
        where: { id: input.employeeId, businessId: input.businessId, isDeleted: false },
        select: { name: true },
      }))?.name ?? ''
    : ''

  const endAt = new Date(input.startAt.getTime() + input.durationMinutes * 60_000)

  // System user for anonymous booking — fall back to the first owner if a
  // dedicated PUBLIC_BOOKING_USER_ID env var is not set.
  const createdById = await resolveCreatorUserId(input.businessId)

  const created = await insertAppointment(prisma, {
    businessId: input.businessId,
    partyId: party.id,
    partyNameSnapshot: party.name,
    employeeId: input.employeeId,
    employeeNameSnapshot: employeeName,
    startAt: input.startAt,
    endAt,
    durationMinutes: minutesBetween(input.startAt, endAt),
    vertical: 'public',
    notes: input.notes,
    serviceId: null,
    idempotencyKey: input.idempotencyKey,
    createdById,
  })

  logger.info('[appointment] public booking created', {
    appointmentId: created.id,
    businessId: input.businessId,
    employeeId: input.employeeId,
    // NOTE: notes intentionally omitted from public-booking logs.
  })

  return created
}

async function resolveCreatorUserId(businessId: string): Promise<string> {
  const { prisma } = await import('../lib/prisma.js')
  const owner = await prisma.businessUser.findFirst({
    where: { businessId, role: 'owner' },
    select: { userId: true },
  })
  if (!owner) throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'Invalid or expired link')
  return owner.userId
}

export default router
