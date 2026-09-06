/**
 * Token-billing checkout & mandate management routes.
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { auth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { idempotencyCheck } from '../../middleware/idempotency.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { FEATURES } from '../../config/features.js'
import { isTokenBillingAllowedForUser } from '../../config/token-billing.js'
import {
  tokenCheckoutSchema,
  mandateCancelSchema,
  mandateAbandonSchema,
} from '../../schemas/token-billing.schema.js'
import {
  MandateExistsError,
  startTokenRegistration,
  cancelMandate,
} from '../../services/subscription/token-engine/token-mandate.service.js'
import { cancelPendingMandateAsAbandoned } from '../../services/subscription/token-engine/token-mandate.lifecycle.js'
import type { SubscriptionPlanTier } from '../../services/subscription/subscription.types.js'

export const tokenCheckoutRouter = Router()
tokenCheckoutRouter.use(auth)

// GET /api/subscription/token-checkout/availability
tokenCheckoutRouter.get(
  '/token-checkout/availability',
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const enabled = FEATURES.TOKEN_BILLING.enabled && isTokenBillingAllowedForUser(userId)
    sendSuccess(res, { enabled })
  }),
)

// POST /api/subscription/token-checkout
tokenCheckoutRouter.post(
  '/token-checkout',
  idempotencyCheck(),
  validate(tokenCheckoutSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const businessId = req.user!.businessId
    const tier = (req.body.tier || req.body.planTier || 'PRO') as SubscriptionPlanTier
    const billingCycle = req.body.billingCycle || 'MONTHLY'

    if (!FEATURES.TOKEN_BILLING.enabled || !isTokenBillingAllowedForUser(userId)) {
      sendError(res, 'Token billing is not available for this account', 'TOKEN_BILLING_DISABLED', 403)
      return
    }

    try {
      const { mandateId, client } = await startTokenRegistration(
        businessId,
        userId,
        tier,
        billingCycle,
      )

      sendSuccess(res, { mandateId, ...client }, 201)
    } catch (e) {
      if (e instanceof MandateExistsError) {
        sendError(res, 'An active mandate registration is already in progress for this business', 'MANDATE_EXISTS', 409)
        return
      }
      throw e
    }
  }),
)

// POST /api/subscription/mandate/cancel
tokenCheckoutRouter.post(
  '/mandate/cancel',
  idempotencyCheck(),
  validate(mandateCancelSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { mandateId, reason } = req.body

    await cancelMandate(mandateId, businessId, (reason as any) || 'user_cancelled')
    sendSuccess(res, { cancelled: true, message: 'Mandate cancelled successfully' })
  }),
)

// POST /api/subscription/mandate/abandon
tokenCheckoutRouter.post(
  '/mandate/abandon',
  idempotencyCheck(),
  validate(mandateAbandonSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await cancelPendingMandateAsAbandoned(businessId)
    sendSuccess(res, { ...result, message: 'Pending mandate abandoned' })
  }),
)
