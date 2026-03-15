/**
 * CSRF protection — adapted from DudhHisaab
 * Double-submit cookie pattern. Stateless.
 * Skipped for: dev/test, Bearer auth, auth routes
 */

import type { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

const CSRF_COOKIE = 'csrf-token'
const CSRF_HEADER = 'x-csrf-token'

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== 'production') return next()
  if (req.headers.authorization?.startsWith('Bearer ')) return next()
  if (req.path.startsWith('/api/auth/') || req.path.startsWith('/api/feedback/')) return next()

  const method = req.method.toUpperCase()

  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!req.cookies?.[CSRF_COOKIE]) {
      res.cookie(CSRF_COOKIE, randomUUID(), {
        httpOnly: false,
        sameSite: 'strict',
        secure: true,
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      })
    }
    return next()
  }

  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const cookieToken = req.cookies?.[CSRF_COOKIE]
    const headerToken = req.headers[CSRF_HEADER] as string | undefined
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return res.status(403).json({
        success: false,
        error: { code: 'CSRF_FAILED', message: 'Invalid CSRF token' },
      })
    }
  }

  next()
}
