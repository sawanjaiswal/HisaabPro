/**
 * Tenant-context middleware (File #9 tenant-isolation, File #27 scoped-prisma-shadow).
 *
 * Opens the business ALS frame for the lifetime of the request so the scoping Prisma
 * extension can AND-merge `businessId` into every query, plus the request-meta frame
 * the shadow harness reads for `provenance` / `routeHint` / `hadBusinessOnToken`.
 *
 * No active business (fresh signup pre-business-create, or an unauthenticated route)
 * → NO business frame is opened, so any scoped query downstream FAILS CLOSED
 * (ScopedContextError → 500) rather than leaking across tenants. Routes that
 * legitimately run without a business (auth, business.create) wrap their own work in
 * `runUnscoped(...)`.
 *
 * Land-dark: harmless while SCOPED_PRISMA_ENFORCE=off — the frames are set but the
 * scoping extension isn't attached to the live client, so behavior is unchanged.
 *
 * The `scopedContext` export this file shipped with is GONE as of #27. It was written
 * to be mounted with `app.use`, had zero call sites, and would have opened no frame at
 * all if it ever gained one: app-level middleware runs before router-level `auth`, so
 * `req.user` is undefined there and every request would take its no-frame branch
 * (FM-17). Leaving an exported function whose only correct number of call sites is
 * zero is the same landed-dark shape this epic exists to remove, so it was deleted
 * rather than documented. `enterTenantFrame` replaces it and is called from `auth`.
 */
import type { NextFunction, Request } from 'express'
import { runInBusinessContext } from '../lib/business-context.js'
import { runWithRequestMeta } from '../lib/request-meta.js'

/**
 * Open BOTH frames for one authenticated request (File #27, ARCHITECTURE §6.1, §6.2).
 *
 * Called from `auth` itself rather than mounted with `app.use`. App-level middleware
 * runs before router-level `auth`, so `req.user` is still undefined there and the
 * business frame never opens — 100% `no-context` records, behind a grep that passes
 * because the call site exists (FM-17). Opening the frame in the same function that
 * sets `req.user` makes that ordering bug structurally impossible, and covers all
 * 138 route files from one place.
 *
 * `runWithRequestMeta` wraps UNCONDITIONALLY, outside the business-frame condition.
 * That is what makes the AA-3 gate falsifiable: `hadBusinessOnToken` has to be
 * recorded when no tenant frame opens — that combination (`http` + `true`) is
 * precisely the continuation leak the exit criterion watches for. Recording it only
 * on the happy path would leave the criterion with no producer.
 */
export function enterTenantFrame(req: Request, next: NextFunction): void {
  const user = req.user
  const meta = {
    method: req.method,
    // A thunk, not a value. `req.route` is populated when the MATCHED handler runs,
    // which is after `auth` — reading it here would yield undefined on every
    // request. The harness evaluates this at record-build time, inside the handler.
    //
    // `req.route.path` is the Express TEMPLATE (`/:id`), never the interpolated
    // path. `req.originalUrl` would write a tenant's primary key into a durable,
    // admin-readable table (MS-8).
    getRouteHint: () => {
      if (!req.route) return ''
      // `path` is '/' for a router's index route, which would render
      // `GET /api/parties/` alongside `GET /api/parties/:id`. Normalised so the
      // hint equals the mount path and the stat rollup keys stay comparable.
      const path = (req.route as { path: string }).path
      return `${req.method} ${req.baseUrl}${path === '/' ? '' : path}`
    },
    hadBusinessOnToken: Boolean(user?.businessId),
  }

  runWithRequestMeta(meta, () => {
    if (!user?.businessId) {
      next()
      return
    }
    runInBusinessContext({ businessId: user.businessId, userId: user.userId }, () => next())
  })
}
