/**
 * requireNoActiveJob — pre-multer gate (S3 fix).
 *
 * Enforces the "1 active import per business" invariant BEFORE multer
 * reads any bytes off the wire. Without this gate, a client could
 * stream 10 MB into memory only to be told (after upload completes)
 * that another job was already in flight — wasting bandwidth, RAM,
 * and the rate-limit budget.
 *
 * "Active" = UPLOADED | PARSING | PREVIEWED with expiresAt > now.
 * COMMITTING is excluded because the advisory lock + DB unique on
 * createdPartyId already guarantees commit-time mutual exclusion.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §3 (middleware order)
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md S3 (pre-multer order)
 */

import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.js'
import { sendError } from '../lib/response.js'
import { ErrorCode } from '../lib/errors.js'
import { getAuth } from '../lib/auth-helper.js'

const ACTIVE_STATUSES = ['UPLOADED', 'PARSING', 'PREVIEWED'] as const

export async function requireNoActiveJob(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const auth = getAuth(req)
    const existing = await prisma.importJob.findFirst({
      where: {
        businessId: auth.businessId,
        status: { in: [...ACTIVE_STATUSES] },
        expiresAt: { gt: new Date() },
      },
      select: { id: true, status: true },
    })
    if (existing) {
      sendError(
        res,
        'Another import is already in progress for this business',
        ErrorCode.ACTIVE_JOB_EXISTS,
        409,
      )
      return
    }
    next()
  } catch (err) {
    next(err)
  }
}
