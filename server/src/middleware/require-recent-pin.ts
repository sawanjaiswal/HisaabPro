/**
 * requireRecentPin — PIN-gate middleware factory (v2.3 A02.2 + A04).
 *
 * Wraps verifyPinGraceCookie() with the per-route-class freshness window.
 * Returns an Express middleware closed over the supplied routeClass:
 *
 *   router.post('/payroll/run/finalize',
 *     requireRecentPin('mutation'),     // 5-min grace
 *     requirePermission('hr.payroll.run'),
 *     ...)
 *
 *   router.get('/audit',
 *     requireRecentPin('read-only'),    // 60-min grace
 *     requirePermission('audit.read'),
 *     ...)
 *
 * Failure mode (always 403, NEVER 401):
 *
 *   Returns 403 PIN_REQUIRED with reason + routeClass. 403 is intentional:
 *   the FE `api.ts` 401-refresh interceptor would otherwise try to refresh
 *   the access token, get back a fresh JWT, and re-fire the request — still
 *   without a PIN — causing an infinite retry loop. 403 sidesteps that
 *   interceptor; PinGateProvider intercepts 403 PIN_REQUIRED, prompts for
 *   PIN, then retries with the fresh grace cookie.
 *
 * Side effects:
 *
 *   1. One SELECT against `UserAppSettings.pinHash` per gated request — used
 *      to recompute the pin fingerprint for A02.2 comparison. S9 caching
 *      deferred (see §17.4 latency acceptance).
 *   2. Security events emitted via verifyPinGraceCookie (HMAC mismatch,
 *      cross-user, cross-tenant, pf_stale). benign pf_stale does NOT roll
 *      up into the cookie_tamper_detected alert (per §10.5).
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §3.7 + §5.3 + §11 + §17.3.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { prisma } from '../lib/prisma.js'
import { sendError } from '../lib/response.js'
import { ErrorCode } from '../lib/errors.js'
import {
  readGraceCookie,
  verifyPinGraceCookie,
  type RouteClass,
  type VerifyFailReason,
} from '../services/security-pin/pin-grace-cookie.js'

/**
 * Map verifier reasons → wire reasons. PinGateProvider on FE uses the wire
 * code to decide whether to prompt for PIN (always) and whether to warn the
 * user about cookie tamper (cross_user / cross_tenant / hmac_mismatch).
 */
function toWireReason(r: VerifyFailReason): string {
  switch (r) {
    case 'missing':         return 'MISSING'
    case 'malformed':       return 'TAMPERED'
    case 'hmac_mismatch':   return 'TAMPERED'
    case 'cross_user':      return 'TAMPERED'
    case 'cross_tenant':    return 'TAMPERED'
    case 'class_mismatch':  return 'MISSING'
    case 'expired':         return 'EXPIRED'
    case 'iat_too_old':     return 'EXPIRED'
    case 'pin_rotated':     return 'PF_STALE'
    default: {
      const _exhaustive: never = r
      return _exhaustive
    }
  }
}

/**
 * Factory — returns a middleware closed over `routeClass`. Must run AFTER
 * `auth` (needs req.user.userId) and `requireActiveBusiness` (needs
 * req.activeBusiness.id for the cross-tenant check).
 */
export function requireRecentPin(routeClass: RouteClass): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId
    const businessId = req.activeBusiness?.id ?? req.user?.businessId

    if (!userId) {
      sendError(res, 'Authentication required', ErrorCode.UNAUTHORIZED, 401)
      return
    }
    if (!businessId) {
      sendError(res, 'No active business selected', ErrorCode.NO_BUSINESS, 403)
      return
    }

    // SELECT current pinHash for fingerprint comparison (A02.2).
    // If the user has never set a PIN, pinHash is null → no cookie can
    // satisfy the fingerprint check, so treat as PIN_REQUIRED:MISSING.
    const settings = await prisma.userAppSettings.findUnique({
      where: { userId },
      select: { pinHash: true },
    })

    if (!settings?.pinHash) {
      respondPinRequired(res, 'MISSING', routeClass)
      return
    }

    const cookieValue = readGraceCookie(req)
    const result = verifyPinGraceCookie(
      cookieValue,
      userId,
      businessId,
      routeClass,
      settings.pinHash,
      undefined,
      { ip: req.ip },
    )

    if (!result.ok) {
      respondPinRequired(res, toWireReason(result.reason), routeClass)
      return
    }

    next()
  }
}

function respondPinRequired(res: Response, reason: string, routeClass: RouteClass): void {
  res.status(403).json({
    success: false,
    error: {
      code: ErrorCode.PIN_REQUIRED,
      message: 'PIN verification required',
      reason,
      routeClass,
    },
  })
}
