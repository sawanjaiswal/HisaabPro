import type { Request, Response, NextFunction } from 'express'
import logger from '../../lib/logger.js'
import { getStore } from './store.js'

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
