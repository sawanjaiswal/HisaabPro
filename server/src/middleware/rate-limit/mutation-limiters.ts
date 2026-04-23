import type { Request, Response, NextFunction } from 'express'
import {
  RATE_LIMIT_GLOBAL_WINDOW_MS,
  RATE_LIMIT_GLOBAL_MAX,
  RATE_LIMIT_SENSITIVE_WINDOW_MS,
  RATE_LIMIT_SENSITIVE_MAX,
  RATE_LIMIT_CRUD_WINDOW_MS,
  RATE_LIMIT_CRUD_MAX,
} from '../../config/security.js'
import { createRateLimiter } from './factory.js'

/**
 * Heartbeat / background-poll paths exempt from the global IP limiter.
 * These are fired by the client on a timer (offline detector, SSE, session check)
 * and burn the IP budget without representing user activity. Rate-limiting them
 * makes the entire app appear "offline" once the IP runs out of tokens.
 *
 * Auth endpoints are still protected by their own stricter limiter.
 */
const HEARTBEAT_PATHS = new Set<string>([
  '/api/health',
  '/api/health/detailed',
  '/api/events/stream',
  '/api/auth/me',
])

const _apiRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_GLOBAL_WINDOW_MS,
  max: RATE_LIMIT_GLOBAL_MAX,
  message: 'Too many requests. Please slow down.',
  eventName: 'rate_limit.global_hit',
})

/** 600 req/min per IP — general API. Skips heartbeat polls. */
export const apiRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  if (HEARTBEAT_PATHS.has(req.path)) return next()
  return _apiRateLimiter(req, res, next)
}

/**
 * CRUD mutation limiter — per-user, only engages on write methods.
 * Applied router-level to documents/products/party/payments. GETs are unaffected.
 * Default: 600 writes/hour/user — generous for real usage, hard cap on runaways.
 */
const userCrudLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_CRUD_WINDOW_MS,
  max: RATE_LIMIT_CRUD_MAX,
  message: 'Too many changes in a short period. Please slow down.',
  keyFn: (req) => `rl:crud:${req.user?.userId ?? req.ip ?? 'unknown'}`,
  eventName: 'rate_limit.crud_hit',
})

/** Router-level guard — applies CRUD limiter only to mutating HTTP methods. */
export const userMutationLimiter = (req: Request, res: Response, next: NextFunction) => {
  const m = req.method
  if (m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE') {
    return userCrudLimiter(req, res, next)
  }
  next()
}

/** 20 req/min per authenticated user — delete, bulk operations */
export const sensitiveMutationLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_SENSITIVE_WINDOW_MS,
  max: RATE_LIMIT_SENSITIVE_MAX,
  message: 'Too many mutating requests. Please slow down.',
  keyFn: (req) => `rl:user:${req.user?.userId ?? req.ip ?? 'unknown'}`,
  eventName: 'rate_limit.sensitive_hit',
})
