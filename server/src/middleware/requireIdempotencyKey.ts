/**
 * Idempotency Key Middleware
 * Validates the X-Idempotency-Key header is a UUID v4.
 * Attaches the key to req.idempotencyKey for downstream handlers.
 *
 * Usage:
 *   router.post('/sales', requireIdempotencyKey, asyncHandler(...))
 */

import type { Request, Response, NextFunction } from 'express'
import { sendError } from '../lib/response.js'

// UUID v4 regex: 8-4-4-4-12 with version=4 and variant bits
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

declare global {
  namespace Express {
    interface Request {
      idempotencyKey?: string
    }
  }
}

export function requireIdempotencyKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const key = req.headers['x-idempotency-key']

  if (typeof key !== 'string' || key.trim() === '') {
    sendError(
      res,
      'X-Idempotency-Key header is required',
      'INVALID_IDEMPOTENCY_KEY',
      400
    )
    return
  }

  if (!UUID_V4_RE.test(key.trim())) {
    sendError(
      res,
      'X-Idempotency-Key must be a valid UUID v4',
      'INVALID_IDEMPOTENCY_KEY',
      400
    )
    return
  }

  req.idempotencyKey = key.trim()
  next()
}
