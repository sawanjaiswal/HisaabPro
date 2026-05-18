/**
 * requireFeature — runtime kill-switch for env-var-gated features.
 *
 * Mounted on /api/hr, /api/payroll, /api/audit (Phase 6 STAFF_HR) so that
 * flipping FEATURE_STAFF_HR=false on Render returns 404 NOT_AVAILABLE for
 * the whole feature surface without a code deploy. This is the runtime
 * counterpart to the ROLLOUT_PHASE6.md §4.1/§4.2 kill-switch — without it
 * the documented rollback is non-functional.
 *
 * Sticky-cohort behaviour: when 0 < cohortPercent < 100, a given userId
 * is consistently in-or-out for that percent. Auth middleware MUST run
 * first so req.user.userId is populated.
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §16 + SECURITY_AUDIT_PASS2
 * SHOULD_FIX-1.
 */

import type { Request, Response, NextFunction } from 'express'
import { isFeatureEnabledForUser, type FeatureKey } from '../config/features.js'
import { sendError } from '../lib/response.js'
import { ErrorCode } from '../lib/errors.js'

export function requireFeature(key: FeatureKey) {
  return function requireFeatureMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    // A01.1: read userId (NOT id) — Prisma drops undefined predicates.
    const userId = req.user?.userId
    if (!userId) {
      sendError(res, 'Authentication required', ErrorCode.UNAUTHORIZED, 401)
      return
    }
    if (!isFeatureEnabledForUser(key, userId)) {
      sendError(res, 'Feature not available', ErrorCode.NOT_FOUND, 404)
      return
    }
    next()
  }
}
