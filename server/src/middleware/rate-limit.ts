import type { Request, Response, NextFunction } from 'express'
import {
  RATE_LIMIT_GLOBAL_WINDOW_MS,
  RATE_LIMIT_GLOBAL_MAX,
  RATE_LIMIT_AUTH_WINDOW_MS,
  RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_DEV_LOGIN_WINDOW_MS,
  RATE_LIMIT_DEV_LOGIN_MAX,
  RATE_LIMIT_OTP_WINDOW_MS,
  RATE_LIMIT_OTP_MAX,
  RATE_LIMIT_SENSITIVE_WINDOW_MS,
  RATE_LIMIT_SENSITIVE_MAX,
  RATE_LIMIT_COUPON_VALIDATE_WINDOW_MS,
  RATE_LIMIT_COUPON_VALIDATE_MAX,
  RATE_LIMIT_COUPON_IP_WINDOW_MS,
  RATE_LIMIT_COUPON_IP_MAX,
  RATE_LIMIT_CRUD_WINDOW_MS,
  RATE_LIMIT_CRUD_MAX,
} from '../config/security.js'
import logger from '../lib/logger.js'

// ---------------------------------------------------------------------------
// Store interface — pluggable backend
// ---------------------------------------------------------------------------

interface RateLimitResult {
  count: number
  resetAt: number
}

/**
 * Pluggable rate limit store.
 * Implement this interface to swap in Redis or any other backend.
 */
export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitResult>
  reset(key: string): Promise<void>
}

// ---------------------------------------------------------------------------
// MemoryStore — default, zero dependencies
// ---------------------------------------------------------------------------

interface MemoryEntry {
  count: number
  resetAt: number
}

class MemoryStore implements RateLimitStore {
  private readonly entries = new Map<string, MemoryEntry>()
  private static readonly MAX_ENTRIES = 50_000 // prevent unbounded memory growth

  constructor() {
    // Evict expired entries every 60 seconds
    setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.entries) {
        if (now > entry.resetAt) this.entries.delete(key)
      }
    }, 60_000).unref()
  }

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now()
    const existing = this.entries.get(key)

    if (!existing || now > existing.resetAt) {
      // Evict oldest entry if at capacity (FIFO)
      if (this.entries.size >= MemoryStore.MAX_ENTRIES) {
        const firstKey = this.entries.keys().next().value
        if (firstKey !== undefined) this.entries.delete(firstKey)
      }
      const entry: MemoryEntry = { count: 1, resetAt: now + windowMs }
      this.entries.set(key, entry)
      return { count: 1, resetAt: entry.resetAt }
    }

    existing.count++
    return { count: existing.count, resetAt: existing.resetAt }
  }

  async reset(key: string): Promise<void> {
    this.entries.delete(key)
  }
}

// ---------------------------------------------------------------------------
// RedisStore — used when REDIS_URL is set and ioredis is available
// ---------------------------------------------------------------------------

async function tryBuildRedisStore(): Promise<RateLimitStore | null> {
  if (!process.env.REDIS_URL) return null

  try {
    // Dynamic import — only loads if ioredis is installed
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — ioredis is an optional peer dependency
    const { default: Redis } = await import('ioredis')
    const client = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
    await client.connect()

    return {
      async increment(key: string, windowMs: number): Promise<RateLimitResult> {
        const windowSec = Math.ceil(windowMs / 1000)
        const pipeline = client.pipeline()
        pipeline.incr(key)
        pipeline.pttl(key)
        const results = await pipeline.exec()

        const count = (results?.[0]?.[1] as number) ?? 1
        const pttl = (results?.[1]?.[1] as number) ?? windowMs

        // Set expiry only on first increment
        if (count === 1) {
          await client.expire(key, windowSec)
        }

        const resetAt = Date.now() + (pttl > 0 ? pttl : windowMs)
        return { count, resetAt }
      },

      async reset(key: string): Promise<void> {
        await client.del(key)
      },
    }
  } catch {
    // ioredis not installed or Redis unreachable — fall back to memory
    logger.warn('rate-limit: Redis unavailable, falling back to MemoryStore')
    return null
  }
}

// Singleton store (resolved once at startup)
let _store: RateLimitStore | null = null

async function getStore(): Promise<RateLimitStore> {
  if (_store) return _store
  _store = (await tryBuildRedisStore()) ?? new MemoryStore()
  return _store
}

// Eagerly initialise so the first request isn't delayed
getStore().catch((err) => {
  logger.warn('Rate limit store init failed, falling back to memory store', {
    error: (err as Error).message,
  })
  _store = new MemoryStore()
})

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

interface RateLimiterOpts {
  windowMs: number
  max: number
  message: string
  /** Key derivation — defaults to req.ip. Override for per-user limiting. */
  keyFn?: (req: Request) => string
  /** Event name for suspicious-pattern logging */
  eventName?: string
}

export function createRateLimiter(opts: RateLimiterOpts) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const store = await getStore()
    const key = opts.keyFn ? opts.keyFn(req) : `rl:${req.ip || 'unknown'}`

    const { count, resetAt } = await store.increment(key, opts.windowMs)
    const remaining = Math.max(0, opts.max - count)

    res.set('X-RateLimit-Limit', String(opts.max))
    res.set('X-RateLimit-Remaining', String(remaining))
    res.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))

    if (count > opts.max) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
      res.set('Retry-After', String(retryAfter))

      if (opts.eventName) {
        logger.warn(opts.eventName, {
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.headers['user-agent'],
          userId: req.user?.userId,
        })
      }

      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: opts.message },
      })
      return
    }

    next()
  }
}

// ---------------------------------------------------------------------------
// Exported limiters
// ---------------------------------------------------------------------------

/** 5 req/min per IP — login, send-otp */
export const authRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX,
  message: 'Too many attempts. Please try again later.',
  eventName: 'rate_limit.auth_hit',
})

/** Dev-login limiter (only mounted when ALLOW_DEV_LOGIN=true). Generous cap so
 *  shared NATs and local automation don't exhaust the bucket during normal use. */
export const devLoginRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_DEV_LOGIN_WINDOW_MS,
  max: RATE_LIMIT_DEV_LOGIN_MAX,
  message: 'Too many dev-login attempts. Please slow down.',
  eventName: 'rate_limit.dev_login_hit',
})

/** 3 req/10min per IP — OTP verification */
export const otpRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_OTP_WINDOW_MS,
  max: RATE_LIMIT_OTP_MAX,
  message: 'Too many OTP requests. Please wait before trying again.',
  eventName: 'rate_limit.otp_hit',
})

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

/** 10 req/min per authenticated user — coupon code validation (brute-force prevention) */
export const couponValidateRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_COUPON_VALIDATE_WINDOW_MS,
  max: RATE_LIMIT_COUPON_VALIDATE_MAX,
  message: 'Too many coupon validation attempts. Please try again later.',
  keyFn: (req) => `rl:coupon:${req.user?.userId ?? req.ip ?? 'unknown'}`,
  eventName: 'rate_limit.coupon_validate_hit',
})

/** 20 req/min per IP — coupon endpoints (cross-user brute-force on shared IPs) */
export const couponIpRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_COUPON_IP_WINDOW_MS,
  max: RATE_LIMIT_COUPON_IP_MAX,
  message: 'Too many coupon requests from this network. Please try again later.',
  keyFn: (req) => `rl:coupon-ip:${req.ip ?? 'unknown'}`,
  eventName: 'rate_limit.coupon_ip_hit',
})
