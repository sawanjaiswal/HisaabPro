/**
 * /api/appointments/waitlist — waitlist add / list / remove.
 *
 * Cross-tenant: partyId / employeeId resolved inside the service via
 * resolveScopedParty / resolveScopedEmployee BEFORE the create. Remove path
 * scopes the row by businessId in `removeFromWaitlist` and returns 404 on
 * mismatch (never 403).
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { sendSuccess } from '../lib/response.js'
import {
  addWaitlistSchema,
  listWaitlistQuerySchema,
  type AddWaitlistBody,
} from '../schemas/appointment-waitlist.schema.js'
import {
  addToWaitlist,
  listWaitlist,
  removeFromWaitlist,
} from '../services/appointment-waitlist.service.js'

const router = Router()

router.use(auth)

/**
 * POST /api/appointments/waitlist
 */
router.post(
  '/waitlist',
  validate(addWaitlistSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const body = req.body as AddWaitlistBody
    const row = await addToWaitlist(
      { businessId, userId },
      {
        partyId: body.partyId,
        employeeId: body.employeeId ?? null,
        desiredStartAt: new Date(body.desiredStartAt),
        desiredEndAt: new Date(body.desiredEndAt),
        notes: body.notes ?? null,
      }
    )
    sendSuccess(res, row, 201)
  })
)

/**
 * GET /api/appointments/waitlist?employeeId=&from=&to=
 */
router.get(
  '/waitlist',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const parsed = listWaitlistQuerySchema.parse(req.query)
    const rows = await listWaitlist(
      { businessId, userId },
      {
        employeeId: parsed.employeeId,
        from: parsed.from ? new Date(parsed.from) : undefined,
        to: parsed.to ? new Date(parsed.to) : undefined,
      }
    )
    sendSuccess(res, rows)
  })
)

/**
 * DELETE /api/appointments/waitlist/:id
 */
router.delete(
  '/waitlist/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    await removeFromWaitlist({ businessId, userId }, String(req.params.id))
    sendSuccess(res, { ok: true })
  })
)

export default router
