/**
 * NIC IRP rate limiter — 10 req/s per businessId.
 * Uses the existing createRateLimiter factory.
 */

import type { Request } from 'express'
import { createRateLimiter } from './rate-limit/factory.js'

export const nicRateLimit = createRateLimiter({
  name: 'nic',
  windowMs: 1_000, // 1 second window
  max: 10,
  message: 'Too many e-invoice requests — max 10/s per business',
  keyFn: (req: Request) => `nic-rl:${req.user?.businessId ?? req.ip ?? 'unknown'}`,
  eventName: 'NIC_RATE_LIMIT_HIT',
})
