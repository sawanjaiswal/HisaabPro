/**
 * Tenant-context middleware (File #9, tenant-isolation Wave A).
 *
 * Opens the business ALS frame for the lifetime of the request so the scoping Prisma
 * extension can AND-merge `businessId` into every query. Mounts AFTER `authenticate`
 * (which populates `req.user`) and BEFORE the route handlers.
 *
 * No active business (fresh signup pre-business-create, or an unauthenticated route)
 * → NO frame is opened, so any scoped query downstream FAILS CLOSED (ScopedContextError
 * → 500) rather than leaking across tenants. Routes that legitimately run without a
 * business (auth, business.create) wrap their own work in `runUnscoped(...)`.
 *
 * Land-dark: harmless to mount while SCOPED_PRISMA_ENFORCE=off — the frame is set but
 * the scoping extension isn't attached to the live client, so behavior is unchanged.
 */
import type { NextFunction, Request, Response } from 'express'
import { runInBusinessContext } from '../lib/business-context.js'

export function scopedContext(req: Request, _res: Response, next: NextFunction): void {
  const user = req.user
  // Empty businessId = no active tenant. Skip the frame so scoped queries fail closed.
  if (!user?.businessId) {
    next()
    return
  }
  runInBusinessContext({ businessId: user.businessId, userId: user.userId }, () => next())
}
