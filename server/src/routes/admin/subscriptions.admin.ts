/**
 * Admin Subscription Routes — super-admin comp grants and revocations.
 *
 * POST /api/admin/subscriptions/:businessId/grant  — grant comp subscription
 * POST /api/admin/subscriptions/:businessId/revoke — revoke grant
 *
 * SECURITY P1-B:
 *  - requireAdmin + requireSuperAdmin: both required (chain)
 *  - Rate limit: 10 grants/min per admin ID (prevents automated bulk grants)
 *  - Self-grant guard enforced in service layer
 * SECURITY P1-E: idempotencyCheck() on all mutations.
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { requireAdmin, requireSuperAdmin } from '../../middleware/admin-auth.js'
import { validate } from '../../middleware/validate.js'
import { idempotencyCheck } from '../../middleware/idempotency.js'
import { createRateLimiter } from '../../middleware/rate-limit.js'
import { sendSuccess } from '../../lib/response.js'
import { AdminGrantReqSchema, AdminRevokeReqSchema } from '../../schemas/subscription.schemas.js'
import { grantComparable, revokeGrant } from '../../services/subscription/subscription-admin.service.js'

export const subscriptionsAdminRouter = Router()

// Rate limiter: 10 grant requests per 60s per admin ID (P1-B)
const adminGrantRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 10,
  keyFn: (req) => `rl:admin:grant:${req.admin?.adminId ?? req.ip}`,
  message: 'Admin grant rate limit exceeded. Please wait before granting more subscriptions.',
  eventName: 'admin_grant.rate_limit_exceeded',
})

// Apply auth to all routes in this router
subscriptionsAdminRouter.use(requireAdmin)
subscriptionsAdminRouter.use(requireSuperAdmin)

// POST /admin/subscriptions/:businessId/grant
subscriptionsAdminRouter.post(
  '/:businessId/grant',
  adminGrantRateLimiter,
  idempotencyCheck(),
  validate(AdminGrantReqSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.params.businessId as string

    const result = await grantComparable({
      businessId,
      tier: req.body.tier,
      months: req.body.months,
      reason: req.body.reason,
      adminId: req.admin!.adminId,
    })

    sendSuccess(res, result, 201)
  }),
)

// POST /admin/subscriptions/:businessId/revoke
subscriptionsAdminRouter.post(
  '/:businessId/revoke',
  idempotencyCheck(),
  validate(AdminRevokeReqSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.params.businessId as string

    const result = await revokeGrant(businessId, req.admin!.adminId)

    sendSuccess(res, result)
  }),
)
