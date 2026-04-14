/**
 * CSRF protection — double-submit cookie pattern. Stateless.
 *
 * Flow:
 *   1. Frontend calls GET /api/auth/csrf-token → server sets csrf httpOnly cookie
 *      AND returns token in response body + x-csrf-token header.
 *   2. On any state-changing request (POST/PUT/PATCH/DELETE), frontend sends
 *      X-CSRF-Token: <token> header. Server compares it to the cookie value.
 *
 * Skipped for:
 *   - Requests with Bearer token (API / mobile clients use JWT, not cookies)
 *   - Specific unauthenticated auth routes (csrf-token, send-otp, verify-otp, dev-login, refresh)
 *   - GET / HEAD / OPTIONS (safe methods)
 */

import type { Request, Response, NextFunction } from 'express'
import { randomUUID, timingSafeEqual } from 'crypto'
import logger from '../lib/logger.js'
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_COOKIE_TTL_MS,
} from '../config/security.js'

/** Auth paths that don't require CSRF (unauthenticated or token-only) */
const CSRF_EXEMPT_AUTH_PATHS = new Set([
  '/api/auth/csrf-token',
  '/api/auth/send-otp',
  '/api/auth/verify-otp',
  '/api/auth/dev-login',
  '/api/auth/refresh',
])

/** Timing-safe string comparison */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (req.headers.authorization?.startsWith('Bearer ')) return next()
  if (CSRF_EXEMPT_AUTH_PATHS.has(req.path)) return next()
  const method = req.method.toUpperCase()

  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
      const token = randomUUID()
      const isProduction = process.env.NODE_ENV === 'production'
      res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax',
        secure: isProduction,
        path: '/',
        maxAge: CSRF_COOKIE_TTL_MS,
      })
      res.set(CSRF_HEADER_NAME, token)
    } else {
      res.set(CSRF_HEADER_NAME, req.cookies[CSRF_COOKIE_NAME])
    }
    return next()
  }

  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME] as string | undefined
    const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined

    if (!cookieToken || !headerToken || !safeCompare(cookieToken, headerToken)) {
      logger.warn('csrf.validation_failed', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'],
        hasCookie: Boolean(cookieToken),
        hasHeader: Boolean(headerToken),
      })

      return res.status(403).json({
        success: false,
        error: { code: 'CSRF_FAILED', message: 'Invalid CSRF token' },
      })
    }
  }

  next()
}
