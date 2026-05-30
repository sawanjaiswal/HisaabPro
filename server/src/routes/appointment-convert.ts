/**
 * /api/appointments/:id/convert — convert a completed/in-progress appointment
 * to a Job (services verticals) or DRAFT Invoice (clinic verticals).
 *
 * Idempotency: dual-layered.
 *   1. `X-Idempotency-Key` header (middleware) — replays the same response
 *      body for mid-flight retries before a row lands.
 *   2. Job.appointmentId / Document.appointmentId FK — once a row exists,
 *      subsequent calls return the same id with replayed=true.
 *
 * Errors:
 *   - 404 cross-tenant / appointment not found
 *   - 409 wrong status (not IN_PROGRESS/COMPLETED) — uses VALIDATION_ERROR
 *         + APPT_ERR.INVALID_STATUS_TRANSITION
 *   - 400 schema validation
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { idempotencyCheck } from '../middleware/idempotency.js'
import { sendSuccess } from '../lib/response.js'
import {
  convertAppointmentSchema,
  type ConvertAppointmentBody,
} from '../schemas/appointment-convert.schema.js'
import {
  convertAppointmentToJob,
  convertAppointmentToInvoice,
} from '../services/appointment-convert.service.js'

const router = Router()

router.use(auth)

/**
 * POST /api/appointments/:id/convert
 * Body: { target: 'job' | 'invoice', notes?, items? }
 * Response: { jobId? | invoiceId?, target, replayed }
 */
router.post(
  '/:id/convert',
  idempotencyCheck(),
  validate(convertAppointmentSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const body = req.body as ConvertAppointmentBody
    const appointmentId = String(req.params.id)

    if (body.target === 'job') {
      const result = await convertAppointmentToJob(
        { businessId, userId },
        appointmentId,
        { notes: body.notes ?? null, items: body.items }
      )
      sendSuccess(res, { jobId: result.jobId, target: 'job' as const, replayed: result.replayed })
      return
    }

    const result = await convertAppointmentToInvoice(
      { businessId, userId },
      appointmentId,
      { notes: body.notes ?? null, items: body.items }
    )
    sendSuccess(res, {
      invoiceId: result.documentId,
      target: 'invoice' as const,
      replayed: result.replayed,
    })
  })
)

export default router
