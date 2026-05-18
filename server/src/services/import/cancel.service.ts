/**
 * Phase 7 — Import Engine · Cancel service (API.5)
 *
 * Cancellation is allowed only from non-terminal pre-commit states:
 *   UPLOADED | PARSING | PREVIEWED  →  CANCELLED.
 * COMMITTING / COMMITTED / PARTIALLY_COMMITTED / FAILED / CANCELLED /
 * EXPIRED are no-ops at the service layer; the route surfaces 409 to the
 * client if rowsAffected=0 (so retries are idempotent).
 *
 * Tenancy is enforced by adding `businessId` AND `userId` to the update
 * predicate — only the uploader can cancel their own job (S5).
 *
 * Cross-references:
 *   - SCOPE_PHASE7_IMPORT_7_1A_PARTIES.md "Cancel flow"
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M1, S5
 */

import { AppError, ErrorCode } from '../../lib/errors.js'
import logger from '../../lib/logger.js'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import type { AuthContext } from '../../types/import.types.js'

const CANCELLABLE_STATUSES = ['UPLOADED', 'PARSING', 'PREVIEWED'] as const

export interface CancelImportJobArgs {
  jobId: string
  auth: AuthContext
  prisma: ExtendedPrismaClient
}

export async function cancelImportJob(
  args: CancelImportJobArgs,
): Promise<{ cancelled: boolean }> {
  const { jobId, auth, prisma } = args
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.importJob.updateMany({
      where: {
        id: jobId,
        businessId: auth.businessId,
        userId: auth.userId,
        status: { in: [...CANCELLABLE_STATUSES] },
      },
      data: { status: 'CANCELLED' },
    })
    if (updated.count === 0) {
      // Either the job is in a terminal state or doesn't belong to this
      // user. Uniform 409 — don't leak which.
      throw new AppError(
        ErrorCode.IMPORT_JOB_NOT_COMMITTABLE,
        409,
        'Import job cannot be cancelled in its current state',
      )
    }
    await tx.auditLog.create({
      data: {
        businessId: auth.businessId,
        entityType: 'ImportJob',
        entityId: jobId,
        userId: auth.userId,
        action: 'UPDATE',
        changes: { event: 'import_job.cancelled' },
      },
    })
    return updated.count
  })
  logger.info('import.cancel.done', {
    jobId,
    businessId: auth.businessId,
    userId: auth.userId,
  })
  return { cancelled: result > 0 }
}
