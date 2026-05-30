/**
 * Businesses routes — Phase 6 #138 tenancy elevation (PR2).
 *
 * Hosts the firm-level suspend/reactivate endpoints. Other `/api/businesses`
 * concerns (CRUD, staff invite, roles, settings) continue to live in
 * `routes/settings.ts` under the same prefix — Express mounts both routers
 * at `/api/businesses` and dispatches by path.
 *
 * Middleware chain per architecture §11:
 *   auth → requireActiveBusiness → requireOwner → validate → handler
 *
 * PR3 wires `requireRecentPin('mutation')` on both endpoints — suspend and
 * reactivate are firm-level state flips that warrant a fresh PIN confirmation
 * within the 5-min mutation window. Order: auth → requireOwner → requireRecentPin
 * → validate → handler.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { requireOwner } from '../middleware/permission.js'
import { requireRecentPin } from '../middleware/require-recent-pin.js'
import { validate } from '../middleware/validate.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { suspendBusinessSchema, reactivateBusinessSchema } from '../schemas/business.schemas.js'
import { suspendBusiness, reactivateBusiness } from '../services/business/suspend.service.js'
import { rotatePublicBookingSecret } from '../services/business-settings-rotation.service.js'

const router = Router()

// Note: we cannot `router.use(requireActiveBusiness)` here because the suspend
// endpoint MUST be reachable AFTER the firm has been suspended (to support
// reactivation via the same path family). Each route opts in individually.

/**
 * POST /api/businesses/:id/suspend
 * Owner pauses their firm. Writes Business.suspendedAt + AuditLog row.
 * Pre-conditions: caller is the firm's owner; firm is currently active
 * (idempotent — re-suspending is a 200 no-op without a new audit row).
 */
router.post(
  '/:id/suspend',
  auth,
  // requireActiveBusiness intentionally skipped on the suspend endpoint: an
  // owner who just suspended their own firm should still be able to call
  // /reactivate without the gate refusing them. Owner-check below replaces
  // the membership liveness check.
  requireOwner(),
  // PR3 — high-risk firm-level mutation; require a recent PIN verify within
  // the 5-min mutation window. 403 PIN_REQUIRED on miss; FE PinGateProvider
  // prompts, then replays the request with the fresh grace cookie.
  requireRecentPin('mutation'),
  validate(suspendBusinessSchema),
  asyncHandler(async (req, res) => {
    // Enforce `:id` === `req.user.businessId` so an owner of biz1 cannot
    // suspend biz2 by forging the path-param. requireOwner has already
    // verified ownership of req.user.businessId; this binds the URL target.
    if (req.params.id !== req.user!.businessId) {
      sendError(res, 'Business mismatch', 'FORBIDDEN', 403)
      return
    }
    const business = await suspendBusiness({
      actorUserId: req.user!.userId,
      businessId: req.params.id!,
      reason: req.body.reason,
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent'],
    })
    sendSuccess(res, { business })
  })
)

/**
 * POST /api/businesses/:id/reactivate
 * Owner restores access. Clears Business.suspendedAt + AuditLog row.
 * Idempotent — reactivating an active firm is a 200 no-op without a new
 * audit row.
 */
router.post(
  '/:id/reactivate',
  auth,
  requireOwner(),
  // PR3 — same gate as /suspend; reactivation is equally high-risk.
  requireRecentPin('mutation'),
  validate(reactivateBusinessSchema),
  asyncHandler(async (req, res) => {
    if (req.params.id !== req.user!.businessId) {
      sendError(res, 'Business mismatch', 'FORBIDDEN', 403)
      return
    }
    const business = await reactivateBusiness({
      actorUserId: req.user!.userId,
      businessId: req.params.id!,
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent'],
    })
    sendSuccess(res, { business })
  })
)

/**
 * POST /api/businesses/:id/rotate-booking-secret
 * Owner rotates the per-business public-booking HMAC secret. Bulk-revokes
 * every outstanding SharedLink so prior URLs stop verifying. Auditable —
 * the service writes a structured info log; we also bind the path param to
 * `req.user.businessId` to prevent cross-tenant rotation.
 */
router.post(
  '/:id/rotate-booking-secret',
  auth,
  requireOwner(),
  requireRecentPin('mutation'),
  asyncHandler(async (req, res) => {
    if (req.params.id !== req.user!.businessId) {
      sendError(res, 'Business mismatch', 'FORBIDDEN', 403)
      return
    }
    const result = await rotatePublicBookingSecret(req.params.id!, req.user!.userId)
    sendSuccess(res, result)
  })
)

export default router
