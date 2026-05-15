/**
 * Mandate Routes — UPI Autopay mandate management.
 *
 * POST /api/subscription/mandate/create   — create UPI mandate (online-only)
 * DELETE /api/subscription/mandate        — revoke active mandate
 * GET  /api/subscription/mandate/status   — get current mandate status
 *
 * SECURITY P1-E: idempotencyCheck() on POST + DELETE.
 * All routes require auth.
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { auth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { idempotencyCheck } from '../../middleware/idempotency.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { prisma } from '../../lib/prisma.js'
import { MandateCreateReqSchema } from '../../schemas/subscription.schemas.js'
import {
  createMandate,
  revokeMandate,
  getMandateStatus,
} from '../../services/subscription/upi-mandate.service.js'

export const mandateRouter = Router()
mandateRouter.use(auth)

// POST /subscription/mandate/create — create UPI mandate (online-only)
mandateRouter.post(
  '/create',
  idempotencyCheck(),
  validate(MandateCreateReqSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId

    // Ensure active subscription exists
    const sub = await prisma.subscription.findUnique({
      where: { businessId },
      select: { id: true, subscriptionState: true },
    })

    if (!sub) {
      sendError(res, 'No subscription found. Cannot create mandate.', 'NOT_FOUND', 404)
      return
    }

    if (!['ACTIVE', 'TRIAL_NO_AUTOPAY', 'PAST_DUE'].includes(sub.subscriptionState)) {
      sendError(
        res,
        `Mandate creation not allowed in state ${sub.subscriptionState}`,
        'INVALID_STATE',
        409,
      )
      return
    }

    const result = await createMandate({
      businessId,
      subscriptionId: sub.id,
      maxAmountPaise: req.body.maxAmountPaise,
      frequency: req.body.frequency,
      upiVpa: req.body.upiVpa,
    })

    sendSuccess(res, result, 201)
  }),
)

// DELETE /subscription/mandate — revoke active mandate
mandateRouter.delete(
  '/',
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId

    // Get current active mandate (tenant-scoped)
    const mandate = await prisma.upiMandate.findFirst({
      where: { businessId, status: { in: ['PENDING', 'ACTIVE'] } },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!mandate) {
      sendError(res, 'No active mandate found', 'NOT_FOUND', 404)
      return
    }

    const result = await revokeMandate(businessId, mandate.id)

    sendSuccess(res, result)
  }),
)

// GET /subscription/mandate/status — get current mandate status
mandateRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const status = await getMandateStatus(businessId)
    sendSuccess(res, status)
  }),
)
