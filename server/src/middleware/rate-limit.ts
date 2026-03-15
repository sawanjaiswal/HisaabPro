import type { Request, Response, NextFunction } from 'express'

/**
 * Simple in-memory rate limiter.
 * Adapted from DudhHisaab's rate-limit.middleware.ts.
 * For production, swap with Redis-backed limiter.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

function createRateLimiter(opts: { windowMs: number; max: number; message: string }) {
  const store = new Map<string, RateLimitEntry>()

  // Cleanup expired entries every minute
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key)
    }
  }, 60_000).unref()

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown'
    const now = Date.now()
    const entry = store.get(key)

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + opts.windowMs })
      return next()
    }

    entry.count++

    if (entry.count > opts.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      res.set('Retry-After', String(retryAfter))
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: opts.message },
      })
      return
    }

    next()
  }
}

/** 5 requests per 15 minutes — login/register */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many attempts. Please try again later.',
})

/** 3 requests per 10 minutes — OTP verification */
export const otpRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: 'Too many OTP requests. Please wait before trying again.',
})

/** 500 requests per 15 minutes — general API (generous for dev; tighten in production) */
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Too many requests. Please slow down.',
})
