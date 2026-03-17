/**
 * CSRF protection — double-submit cookie pattern. Stateless.
 *
 * Flow:
 *   1. Frontend calls GET /api/auth/csrf-token → server sets __Host-csrf httpOnly cookie
 *      AND returns token in response body + x-csrf-token header.
 *   2. On any state-changing request (POST/PUT/PATCH/DELETE), frontend sends
 *      X-CSRF-Token: <token> header. Server compares it to the cookie value.
 *
 * Skipped for:
 *   - Non-production environments
 *   - Requests with Bearer token (API / mobile clients use JWT, not cookies)
 *   - Auth routes (they use their own token flow)
 *   - Feedback routes (public submission)
 *   - GET / HEAD / OPTIONS (safe methods)
 */

import type { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import logger from '../lib/logger.js'
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_COOKIE_TTL_MS,
} from '../config/security.js'

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== 'production') return next()
  if (req.headers.authorization?.startsWith('Bearer ')) return next()
  if (req.path.startsWith('/api/auth/') || req.path.startsWith('/api/feedback/')) return next()

  const method = req.method.toUpperCase()

  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
      const token = randomUUID()
      res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: true,
        path: '/',
        maxAge: CSRF_COOKIE_TTL_MS,
      })
      res.set(CSRF_HEADER_NAME, token)
    } else {
      // Return existing token in header so frontend can read it
      res.set(CSRF_HEADER_NAME, req.cookies[CSRF_COOKIE_NAME])
    }
    return next()
  }

  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME] as string | undefined
    const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
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
