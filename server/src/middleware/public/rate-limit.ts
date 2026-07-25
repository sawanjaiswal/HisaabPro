/**
 * Public-surface rate limiter — per-route-group, per-IP buckets.
 *
 * Buckets (separate keyspaces so hitting one endpoint can't starve another):
 *   pub:health:<ip>   120/min
 *   pub:invoice:<ip>   60/min
 *   pub:store:<ip>    120/min
 *   pub:invite:<ip>    30/min
 *   pub:claim:<ip>     10/min
 *
 * Uses the same pluggable RateLimitStore as the rest of the app
 * (MemoryStore for MVP; swap to Redis by setting REDIS_URL).
 */

import type { Request, Response, NextFunction } from 'express'
import { createRateLimiter } from '../rate-limit/factory.js'

export type PublicRouteGroup = 'health' | 'invoice' | 'store' | 'invite' | 'claim'

const WINDOW_MS = 60_000 // 1 minute

const BUCKET_CONFIG: Record<PublicRouteGroup, number> = {
  health: 120,
  invoice: 60,
  store: 120,
  invite: 30,
  claim: 10,
}

function makeKeyFn(group: PublicRouteGroup) {
  return (req: Request) => `pub:${group}:${req.ip ?? 'unknown'}`
}

const limiters: Record<PublicRouteGroup, ReturnType<typeof createRateLimiter>> = {
  health: createRateLimiter({
    name: 'public-health',
    windowMs: WINDOW_MS,
    max: BUCKET_CONFIG.health,
    message: 'Too many requests',
    keyFn: makeKeyFn('health'),
    eventName: 'rate_limit.public_health',
  }),
  invoice: createRateLimiter({
    name: 'public-invoice',
    windowMs: WINDOW_MS,
    max: BUCKET_CONFIG.invoice,
    message: 'Too many requests',
    keyFn: makeKeyFn('invoice'),
    eventName: 'rate_limit.public_invoice',
  }),
  store: createRateLimiter({
    name: 'public-store',
    windowMs: WINDOW_MS,
    max: BUCKET_CONFIG.store,
    message: 'Too many requests',
    keyFn: makeKeyFn('store'),
    eventName: 'rate_limit.public_store',
  }),
  invite: createRateLimiter({
    name: 'public-invite',
    windowMs: WINDOW_MS,
    max: BUCKET_CONFIG.invite,
    message: 'Too many requests',
    keyFn: makeKeyFn('invite'),
    eventName: 'rate_limit.public_invite',
  }),
  claim: createRateLimiter({
    name: 'public-claim',
    windowMs: WINDOW_MS,
    max: BUCKET_CONFIG.claim,
    message: 'Too many requests',
    keyFn: makeKeyFn('claim'),
    eventName: 'rate_limit.public_claim',
  }),
}

/**
 * Returns Express middleware that applies the rate-limit bucket for
 * the given public route group.
 */
export function publicRateLimiter(group: PublicRouteGroup) {
  return (req: Request, res: Response, next: NextFunction) => {
    return limiters[group](req, res, next)
  }
}

/**
 * Exported for use by resolvePublicToken to programmatically track
 * usage without going through the middleware.  Returns true if under
 * the limit; returns false if the limit was exceeded (caller should 429).
 *
 * NOTE: In this architecture the middleware handles 429s for the named
 * endpoints; this helper is available for future non-middleware use.
 */
export { BUCKET_CONFIG, WINDOW_MS }
