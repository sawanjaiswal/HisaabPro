/**
 * Commission #128 — commissionLedgerAuth factory middleware.
 * Security audit M5 (replaces fragile inline `res.headersSent` chain).
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §6.3.
 *
 * Two paths, single-pass (no `res.headersSent` chain):
 *  1. No staffUserId query param, OR staffUserId === caller.userId
 *     → viewing own ledger; rely on baseline auth (no extra permission).
 *  2. staffUserId is different
 *     → must hold `commission.view_all`; defer to requirePermission.
 *
 * The cross-tenant 404 check (M4) lives INSIDE the route handler — it
 * needs prisma access and a domain-specific error (STAFF_NOT_FOUND).
 *
 * §17.3 factory grep test: `git grep -n "commissionLedgerAuth\|res.headersSent"
 *   server/src/routes/commission.routes.ts` MUST find `commissionLedgerAuth`
 *   imported + used; MUST NOT find `res.headersSent` (that's the old pattern).
 */

import type { Request, Response, NextFunction } from 'express'
import { requirePermission } from './permission.js'

export function commissionLedgerAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const targetUserId =
    typeof req.query.staffUserId === 'string' ? req.query.staffUserId : undefined

  // Path 1: viewing own ledger (or no param) → no extra permission required.
  if (!targetUserId || targetUserId === req.user?.userId) {
    next()
    return
  }
  // Path 2: viewing someone else's → must hold commission.view_all.
  void requirePermission('commission.view_all')(req, res, next)
}
