/**
 * Admin Authentication Middleware
 *
 * Separate JWT audience claim from regular user tokens.
 * All admin tokens carry aud: 'admin' so they are cryptographically
 * rejected by the regular user auth middleware and vice-versa.
 *
 * SECURITY: Role is verified from DB on every request to handle
 * role revocation without waiting for JWT expiry.
 */

import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { sendError } from '../lib/response.js'
import { isBlacklisted } from '../lib/token-blacklist.js'
import logger from '../lib/logger.js'
import type { AdminRole } from '@prisma/client'

// --------------------------------------------------------------------------
// Environment guards
// --------------------------------------------------------------------------

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required')
}

const JWT_SECRET: string = process.env.JWT_SECRET

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface AdminTokenPayload {
  adminId: string
  email: string
  role: AdminRole
  aud: 'admin'
  type: 'access' | 'refresh'
}

// Extend Express Request with typed admin property
declare global {
  namespace Express {
    interface Request {
      admin?: {
        adminId: string
        email: string
        role: AdminRole
      }
    }
  }
}

// --------------------------------------------------------------------------
// Token helpers
// --------------------------------------------------------------------------

const ADMIN_ACCESS_EXPIRY = '15m'
const ADMIN_REFRESH_EXPIRY = '7d'

/** Generate an admin access + refresh token pair */
export function generateAdminTokens(adminId: string, email: string, role: AdminRole) {
  const base = { adminId, email, role, aud: 'admin' as const }

  const accessToken = jwt.sign(
    { ...base, type: 'access' } satisfies AdminTokenPayload,
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ADMIN_ACCESS_EXPIRY } as jwt.SignOptions
  )

  const refreshToken = jwt.sign(
    { ...base, type: 'refresh' } satisfies AdminTokenPayload,
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ADMIN_REFRESH_EXPIRY } as jwt.SignOptions
  )

  return { accessToken, refreshToken }
}

/** Verify and decode an admin token — throws on failure */
function verifyAdminToken(token: string, expectedType: 'access' | 'refresh'): AdminTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
    audience: 'admin',
  }) as AdminTokenPayload

  if (decoded.type !== expectedType) {
    throw new Error(`Expected ${expectedType} token`)
  }

  return decoded
}

// --------------------------------------------------------------------------
// Middleware: requireAdmin — ADMIN or SUPER_ADMIN
// --------------------------------------------------------------------------

/**
 * Require a valid admin JWT.
 * Resolves token from Authorization: Bearer <token> header.
 * Verifies role from DB on every call to catch role revocations.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    sendError(res, 'Admin authentication required', 'UNAUTHORIZED', 401)
    return
  }

  const token = authHeader.slice(7)

  // Reject blacklisted tokens (logout, rotation)
  if (isBlacklisted(token)) {
    sendError(res, 'Token has been revoked', 'TOKEN_REVOKED', 401)
    return
  }

  let decoded: AdminTokenPayload
  try {
    decoded = verifyAdminToken(token, 'access')
  } catch (err: unknown) {
    const e = err as { name?: string }
    if (e.name === 'TokenExpiredError') {
      sendError(res, 'Admin token expired', 'TOKEN_EXPIRED', 401)
      return
    }
    sendError(res, 'Invalid admin token', 'INVALID_TOKEN', 401)
    return
  }

  // DB verification — verify role and active status (MUST be awaited)
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.adminId },
      select: { role: true, isActive: true },
    })

    if (!admin) {
      sendError(res, 'Admin account not found', 'UNAUTHORIZED', 401)
      return
    }

    if (!admin.isActive) {
      sendError(res, 'Admin account is inactive', 'ACCOUNT_INACTIVE', 403)
      return
    }

    // Catch JWT role vs DB role mismatch (role downgrade while token still live)
    if (admin.role !== decoded.role) {
      logger.warn('Admin role mismatch: JWT claims role but DB disagrees', {
        adminId: decoded.adminId,
        jwtRole: decoded.role,
        dbRole: admin.role,
      })
    }

    req.admin = {
      adminId: decoded.adminId,
      email: decoded.email,
      role: admin.role,
    }

    next()
  } catch {
    sendError(res, 'Admin authentication failed', 'UNAUTHORIZED', 401)
  }
}

// --------------------------------------------------------------------------
// Middleware: requireSuperAdmin — SUPER_ADMIN only
// --------------------------------------------------------------------------

/**
 * Require SUPER_ADMIN role.
 * Builds on requireAdmin: run requireAdmin first, then this guard.
 * Used as middleware chain: [requireAdmin, requireSuperAdmin]
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.admin) {
    sendError(res, 'Admin authentication required', 'UNAUTHORIZED', 401)
    return
  }

  if (req.admin.role !== 'SUPER_ADMIN') {
    sendError(res, 'Super admin access required', 'FORBIDDEN', 403)
    return
  }

  next()
}

// --------------------------------------------------------------------------
// Audit helper
// --------------------------------------------------------------------------

/**
 * Record an admin action in the AdminAction table.
 * Non-blocking — errors are logged but do not fail the request.
 */
export async function auditAdminAction(
  req: Request,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!req.admin) return

  try {
    await prisma.adminAction.create({
      data: {
        adminId: req.admin.adminId,
        action,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        metadata: (metadata ?? {}) as object,
        ipAddress: req.ip ?? null,
        userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
      },
    })
  } catch (err) {
    logger.error('Failed to record admin audit action', { action, err })
  }
}
