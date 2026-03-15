import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../lib/jwt.js'
import { isBlacklisted, isUserBlacklisted } from '../lib/token-blacklist.js'
import { sendError } from '../lib/response.js'

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; phone: string }
    }
  }
}

/** Verify JWT access token with blacklist checks */
export function auth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    sendError(res, 'Authentication required', 'UNAUTHORIZED', 401)
    return
  }

  const token = header.slice(7)

  // Reject revoked tokens
  if (isBlacklisted(token)) {
    sendError(res, 'Token has been revoked', 'TOKEN_REVOKED', 401)
    return
  }

  try {
    const payload = verifyAccessToken(token)

    // Block suspended/deleted users
    if (isUserBlacklisted(payload.userId)) {
      sendError(res, 'Account has been deactivated', 'ACCOUNT_DEACTIVATED', 401)
      return
    }

    req.user = { userId: payload.userId, phone: payload.phone }
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
