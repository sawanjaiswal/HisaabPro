/**
 * resolvePublicToken — single entry point for all /api/p/:token handlers.
 *
 * Every handler that accepts a `:token` URL param MUST call this as its
 * first operation.  No handler may inline hash-lookup, revoked, expired, or
 * resource-type checks (those are the bug factory the security audit flagged).
 *
 * Augments `req.publicLink` with the resolved SharedLink row.
 */

import crypto from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import type { SharedLink } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type PublicLinkErrorCode =
  | 'LINK_NOT_FOUND'       // 404 — token hash not found in DB
  | 'LINK_REVOKED'         // 410
  | 'LINK_EXPIRED'         // 410
  | 'LINK_CONSUMED'        // 410 — one-shot already claimed
  | 'RESOURCE_TYPE_MISMATCH' // 400

export class PublicLinkError extends Error {
  constructor(
    public readonly code: PublicLinkErrorCode,
    public readonly httpStatus: number
  ) {
    super(code)
    this.name = 'PublicLinkError'
  }
}

// ---------------------------------------------------------------------------
// Module augmentation — extend Express Request
// ---------------------------------------------------------------------------

declare module 'express-serve-static-core' {
  interface Request {
    publicLink?: SharedLink
  }
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function auditPublicAccess(params: {
  tokenHash: string
  resourceType: string
  resourceId: string
  ip: string | undefined
  ua: string | undefined
}): void {
  logger.info('public_link_access', {
    event: 'public_link_access',
    tokenHash: params.tokenHash,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    ip: params.ip,
    ua: params.ua,
    ts: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------------------
// Core resolver — used both as middleware and as a direct helper
// ---------------------------------------------------------------------------

export async function resolvePublicTokenHelper(
  req: Request,
  expectedResource: 'INVOICE' | 'INVITE' | 'STORE'
): Promise<SharedLink> {
  const raw = String(req.params['token'] ?? '')

  if (!raw || raw.length < 16 || raw.length > 128) {
    throw new PublicLinkError('LINK_NOT_FOUND', 404)
  }

  const tokenHash = sha256(raw)

  const link = await prisma.sharedLink.findUnique({ where: { tokenHash } })
  if (!link) {
    throw new PublicLinkError('LINK_NOT_FOUND', 404)
  }

  // Resource-type check — 400 so callers know the token shape is wrong
  if (link.resourceType !== expectedResource) {
    throw new PublicLinkError('RESOURCE_TYPE_MISMATCH', 400)
  }

  if (link.revokedAt != null) {
    throw new PublicLinkError('LINK_REVOKED', 410)
  }

  if (link.expiresAt != null && link.expiresAt < new Date()) {
    throw new PublicLinkError('LINK_EXPIRED', 410)
  }

  if (link.claimedAt != null) {
    throw new PublicLinkError('LINK_CONSUMED', 410)
  }

  // Audit log — fire-and-forget (never block the request on this)
  auditPublicAccess({
    tokenHash,
    resourceType: link.resourceType,
    resourceId: link.resourceId,
    ip: req.ip,
    ua: req.get('user-agent'),
  })

  // Bump counters — also fire-and-forget; a bump failure is non-fatal
  prisma.sharedLink
    .update({
      where: { id: link.id },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    })
    .catch((err: unknown) => {
      logger.warn('sharedLink access bump failed', {
        id: link.id,
        err: err instanceof Error ? err.message : String(err),
      })
    })

  return link
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * Returns Express middleware that resolves the `:token` URL param and
 * attaches `req.publicLink`.  On any error sends the appropriate HTTP
 * status and stops the chain.
 *
 * Usage:
 *   router.get('/invoice/:token', resolvePublicToken('INVOICE'), handler)
 */
export function resolvePublicToken(expectedResource: 'INVOICE' | 'INVITE' | 'STORE') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.publicLink = await resolvePublicTokenHelper(req, expectedResource)
      next()
    } catch (err) {
      if (err instanceof PublicLinkError) {
        res.status(err.httpStatus).json({
          success: false,
          error: { code: err.code, message: err.message },
        })
        return
      }
      next(err)
    }
  }
}
