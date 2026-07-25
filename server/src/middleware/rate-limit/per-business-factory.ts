/**
 * Per-business rate limiter (M3 closure).
 *
 * Wraps the generic `createRateLimiter` factory and derives its key from
 * `req.activeBusiness.id` so a noisy tenant cannot exhaust quota for the
 * rest of the platform. The key is namespaced by `prefix` so different
 * routes (preview, finalize, audit-export) get independent counters.
 *
 * Hard rule (M3): if `req.activeBusiness` is not populated by the time
 * the limiter runs, REFUSE THE REQUEST with 401. Silently degrading to a
 * global rate-limit key (`'NO_BIZ'`) would let an unauthenticated caller
 * trip the limit and starve every legitimate request. Fail-closed.
 *
 * Standard middleware chain places this AFTER `requireActiveBusiness`:
 *
 *   router.post('/payroll/run/preview',
 *     auth,
 *     requireActiveBusiness,
 *     requirePermission('hr.read'),
 *     createPerBusinessLimiter('payroll-preview', 10, 60_000),
 *     ...)
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §6 (routes) + §10.4 + M3 closure.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { createRateLimiter } from './factory.js'
import { sendError } from '../../lib/response.js'
import { ErrorCode } from '../../lib/errors.js'

export interface PerBusinessLimiterOpts {
  /** Optional event name for suspicious-pattern logging when threshold trips. */
  eventName?: string
  /** Override message — defaults to 'Too many requests. Try again shortly.' */
  message?: string
}

/**
 * Build a rate-limit middleware keyed by `${prefix}:${activeBusinessId}`.
 *
 * @param prefix       Per-route namespace (e.g. 'payroll-preview'). Required.
 * @param max          Max requests per window per business.
 * @param windowMs     Window in milliseconds (e.g. 60_000 for 1 min).
 * @param opts         Optional eventName / message overrides.
 */
export function createPerBusinessLimiter(
  prefix: string,
  max: number,
  windowMs: number,
  opts: PerBusinessLimiterOpts = {},
): RequestHandler {
  const inner = createRateLimiter({
    name: prefix,
    windowMs,
    max,
    message: opts.message ?? 'Too many requests. Try again shortly.',
    eventName: opts.eventName,
    keyFn: (req: Request) => {
      // requireActiveBusiness MUST have run; if not, keyFn returns a
      // sentinel which the outer guard refuses with 401.
      const bizId = req.activeBusiness?.id
      return bizId ? `rl:${prefix}:${bizId}` : `rl:${prefix}:NO_BIZ`
    },
  })

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Fail-closed: refuse if active-business not populated. NEVER silently
    // limit-to-global — that would let an unauthenticated request burn quota
    // for everyone (M3).
    if (!req.activeBusiness?.id) {
      sendError(
        res,
        'Active business required before rate-limited route',
        ErrorCode.UNAUTHORIZED,
        401,
      )
      return
    }
    return inner(req, res, next)
  }
}
