import type { Request, Response, NextFunction } from 'express'
import logger from '../../lib/logger.js'
import { getStore } from './store.js'

interface RateLimiterBase {
  windowMs: number
  max: number
  message: string
  /** Event name for suspicious-pattern logging */
  eventName?: string
}

/**
 * A limiter must own an identifiable bucket. Either it derives its own key
 * (`keyFn`, which every per-user/per-business limiter already namespaces), or it
 * falls back to per-IP keying — and then `name` is REQUIRED, because it is the
 * only thing separating one limiter's counter from another's.
 *
 * Without it, every IP-keyed limiter derived `rl:<ip>`: the global (600/min),
 * auth (20/min) and OTP (3/10min) limiters incremented and read ONE count while
 * each compared it against its own max, so the strictest max governed all
 * traffic. 25 ordinary GETs — a quarter of the global budget — were enough to
 * 429 the next `/api/auth/refresh` and log an active user out.
 * See .claude/fix-trace-ratelimit-shared-bucket.md.
 */
type RateLimiterOpts = RateLimiterBase &
  (
    | { name: string; keyFn?: undefined }
    | { keyFn: (req: Request) => string; name?: string }
  )

export function createRateLimiter(opts: RateLimiterOpts) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const store = await getStore()
    const key = opts.keyFn ? opts.keyFn(req) : `rl:${opts.name}:${req.ip || 'unknown'}`

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
