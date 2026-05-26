/**
 * requireActiveBusiness — tenancy gate (v2.3 A01.1).
 *
 * Runs AFTER `auth` middleware. Verifies that the JWT-asserted user actually
 * holds an active membership in the JWT-asserted business AND that neither
 * the user-side membership nor the firm itself is suspended.
 *
 * Failure modes (all 403, distinct codes for FE branching + telemetry):
 *
 *   NO_BUSINESS        — JWT has no businessId (user has no firms)
 *   NO_MEMBERSHIP      — BusinessUser row not found (kicked / never invited)
 *   MEMBER_SUSPENDED   — BusinessUser.suspendedAt is set
 *   FIRM_SUSPENDED     — Business.suspendedAt is set (whole firm offline)
 *
 * On success: populates `req.activeBusiness = { id, role }` for downstream
 * middleware (requirePermission, rate-limit/per-business-factory, audit).
 *
 * ────────────────────────────────────────────────────────────────────────
 *  A01.1 CRITICAL — uses `req.user.userId`, NOT `req.user.id`.
 *
 *  `AuthRequest['user']` shape per middleware/auth.ts:75 is
 *  `{ userId, phone, businessId }` — there is no `.id`. Reading `.id`
 *  yields `undefined`, and `findFirst({ where: { userId: undefined, ...}})`
 *  silently DROPS the userId filter under Prisma's "undefined = no-op"
 *  semantics — returning the FIRST BusinessUser for the business
 *  regardless of caller identity. That is a cross-tenant IDOR. The test
 *  at __tests__/require-active-business.test.ts exercises this counter-
 *  example. NEVER change `userId` to `id` here.
 * ────────────────────────────────────────────────────────────────────────
 *
 * S9 (caching) deferred — every gated request runs one BusinessUser SELECT
 * to avoid the stale-permission window after a suspend. See §17.4 latency
 * acceptance.
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §3 + SECURITY_AUDIT A01.1.
 */

import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.js'
import { sendError } from '../lib/response.js'
import { ErrorCode } from '../lib/errors.js'

export interface ActiveBusinessContext {
  id: string
  role: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      activeBusiness?: ActiveBusinessContext
    }
  }
}

export async function requireActiveBusiness(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // auth middleware MUST run first — req.user.userId is the trust anchor
  const userId = req.user?.userId
  const businessId = req.user?.businessId

  // M1 — assert non-empty string. `auth` may have populated `req.user`
  // with a malformed token claim shape (older clients) and we MUST refuse
  // to continue: dropping `undefined` into Prisma where-clauses below
  // silently strips the userId filter and yields cross-tenant IDOR.
  if (typeof userId !== 'string' || userId.length === 0) {
    sendError(
      res,
      'req.user.userId missing — middleware order broken',
      ErrorCode.INTERNAL_ERROR,
      500,
    )
    return
  }
  if (!userId) {
    sendError(res, 'Authentication required', ErrorCode.UNAUTHORIZED, 401)
    return
  }
  if (!businessId) {
    sendError(res, 'No active business selected', ErrorCode.NO_BUSINESS, 403)
    return
  }

  // CRITICAL (A01.1): filter by `req.user.userId` (NOT `.id`) so Prisma never
  // drops the userId predicate to `undefined` and leaks another tenant's row.
  const membership = await prisma.businessUser.findFirst({
    where: { userId, businessId },
    select: {
      role: true,
      suspendedAt: true,
      business: { select: { suspendedAt: true, isActive: true } },
    },
  })

  if (!membership) {
    sendError(res, 'You are not a member of this business', ErrorCode.NO_MEMBERSHIP, 403)
    return
  }

  if (membership.suspendedAt) {
    sendError(
      res,
      'Your membership in this business has been suspended',
      ErrorCode.MEMBER_SUSPENDED,
      403,
    )
    return
  }

  if (membership.business.suspendedAt || membership.business.isActive === false) {
    sendError(res, 'This business has been suspended', ErrorCode.FIRM_SUSPENDED, 403)
    return
  }

  req.activeBusiness = { id: businessId, role: membership.role }
  next()
}
