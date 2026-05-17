/**
 * Loyalty #125 — posCheckoutAuth middleware.
 * Security audit S3 + M5 (route-layer 403 BEFORE tx opens).
 *
 * When a POS checkout payload contains a `loyalty_redemption` payment entry,
 * the cashier needs the `loyalty.redeem` permission IN ADDITION TO the
 * `pos.create` permission. This middleware shortcuts the check: if no such
 * payment is in the body it is a no-op; if one is present it delegates to
 * `requirePermission('loyalty.redeem')`.
 *
 * Slot in `pos-sales.ts` (architecture v5 §3.1) — BETWEEN `auth` and
 * `requireIdempotencyKey`:
 *
 *   router.post('/',
 *     auth,
 *     posCheckoutAuth,                 // <-- this
 *     requireIdempotencyKey,
 *     requirePermission('pos.create'),
 *     idempotencyCheck(),
 *     asyncHandler(...))
 *
 * Why between `auth` and `requireIdempotencyKey`: we need `req.user`
 * (set by `auth`) for the permission lookup, and we want to short-circuit
 * BEFORE `idempotencyCheck()` so a failed permission DOES NOT consume the
 * client's idempotency key. (Test 12.15 asserts zero PosSale rows AND zero
 * idempotency rows on 403.)
 */

import type { Request, Response, NextFunction } from 'express'
import { requirePermission } from './permission.js'

interface PaymentLike {
  mode?: unknown
}

export function posCheckoutAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = (req.body ?? {}) as { payments?: unknown }
  const payments = Array.isArray(body.payments) ? body.payments : []

  const hasLoyaltyRedemption = payments.some(
    (p: PaymentLike) => p?.mode === 'loyalty_redemption'
  )

  if (!hasLoyaltyRedemption) {
    next()
    return
  }

  void requirePermission('loyalty.redeem')(req, res, next)
}
