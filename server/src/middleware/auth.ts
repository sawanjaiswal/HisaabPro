import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../lib/jwt.js'
import { isBlacklisted, isUserBlacklisted } from '../lib/token-blacklist.js'
import { sendError } from '../lib/response.js'
import { prisma } from '../lib/prisma.js'
import { ACCESS_TOKEN_COOKIE } from '../config/security.js'

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; phone: string; businessId: string }
    }
  }
}

/**
 * Verify JWT access token with blacklist checks.
 *
 * Token resolution order (backward-compatible for migration period):
 *   1. httpOnly cookie (__Host-at) — preferred, set by login/refresh endpoints
 *   2. Authorization: Bearer <token> — legacy support while frontend migrates
 *
 * SECURITY: Checks isSuspended from DB on every request to handle
 * suspension without waiting for JWT expiry. (C3 fix)
 */
export async function auth(req: Request, res: Response, next: NextFunction) {
  // 1. Try cookie first
  let token: string | undefined = req.cookies?.[ACCESS_TOKEN_COOKIE]

  // 2. Fall back to Authorization header
  if (!token) {
    const header = req.headers.authorization
    if (header?.startsWith('Bearer ')) {
      token = header.slice(7)
    }
  }

  if (!token) {
    sendError(res, 'Authentication required', 'UNAUTHORIZED', 401)
    return
  }

  // Reject revoked tokens
  if (isBlacklisted(token)) {
    sendError(res, 'Token has been revoked', 'TOKEN_REVOKED', 401)
    return
  }

  try {
    const payload = verifyAccessToken(token)

    // Block suspended/deleted users (in-memory fast path)
    if (isUserBlacklisted(payload.userId)) {
      sendError(res, 'Account has been deactivated', 'ACCOUNT_DEACTIVATED', 401)
      return
    }

    // DB verification: check isSuspended flag (survives server restart)
    // MUST be awaited — fire-and-forget allows suspended users through
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isSuspended: true, isActive: true },
    })

    if (!user || !user.isActive) {
      sendError(res, 'Account not found or inactive', 'ACCOUNT_DEACTIVATED', 401)
      return
    }
    if (user.isSuspended) {
      sendError(res, 'Account has been suspended', 'ACCOUNT_SUSPENDED', 403)
      return
    }

    req.user = { userId: payload.userId, phone: payload.phone, businessId: payload.businessId ?? '' }
    next()
  } catch (error: unknown) {
    const err = error as { name?: string }
    if (err.name === 'TokenExpiredError') {
      sendError(res, 'Token expired', 'TOKEN_EXPIRED', 401)
      return
    }
    sendError(res, 'Invalid token', 'INVALID_TOKEN', 401)
  }
}
