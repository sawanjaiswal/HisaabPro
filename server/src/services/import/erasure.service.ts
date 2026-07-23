// PII: logger / audit calls MUST NOT include raw cell content — only
// jobId, userId, counts (S9).
/**
 * Phase 7 — Import Engine · DPDP erasure cascade (API.7)
 *
 * Called from the platform-wide user-erasure pipeline (Right-to-Erasure
 * under DPDP §17). For every ImportJob the user uploaded:
 *   - clear `fileName` (PII — original filename may carry the user's
 *     own naming convention) and zero out `fileSha256` so the hash
 *     cannot be used to fingerprint the user post-erasure.
 *   - NULL every `raw` + `normalized` payload on the job's rows
 *     (these can carry counterparty PII — phone numbers, GSTINs).
 *
 * Audit-log rows are deliberately preserved (immutable history per
 * SECURITY_AUDIT §M5 / DPDP §17 carve-out for legal-hold) — only the
 * payload references the userId, not the raw cells. Wired into the
 * top-level erasure pipeline once `user-erasure.service.ts` lands.
 *
 * tx-scoped: the caller owns the transaction so a partial erasure
 * across multiple services rolls back cleanly.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §9 (DPDP retention + erasure)
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M5 / S9
 */

import type { Prisma } from '@prisma/client'
import logger from '../../lib/logger.js'

// Structural type — accepts ExtendedPrismaClient OR a $transaction tx.
// We require the raw-SQL escape AND the audit-log writer (immutable
// erasure record per M5) — nothing from the ImportJob model surface
// itself, so the tx object passed by $transaction works without
// prisma-client-extension propagation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxLike = Pick<Prisma.TransactionClient, '$executeRaw' | '$queryRaw'> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auditLog: { create: (args: { data: any }) => Promise<unknown> }
}

export interface EraseImportDataResult {
  jobsScrubbed: number
  rowsScrubbed: number
}

/**
 * Scrub all import PII for `userId`. Idempotent — re-running is a no-op
 * because subsequent UPDATEs match 0 rows.
 *
 * NOTE: Audit log rows are NOT deleted. The user's identity is de-referenced
 * from every AuditLog row (step 2b sets `userId = NULL`) so the parent pipeline
 * can later delete the User — `AuditLog.userId` is `onDelete: Restrict`, so a
 * lingering reference would BLOCK the delete (it does not "dangle"). The
 * erasure record this service writes is itself system-scoped (`userId` null,
 * `systemActor` set) for the same reason. `ImportJob.user` is also Restrict, so
 * the parent must call this BEFORE deleting the User.
 */
export async function eraseImportData(
  userId: string,
  tx: TxLike,
): Promise<EraseImportDataResult> {
  // 1) NULL filename + zero out sha256 on every ImportJob owned by user.
  const jobsScrubbed = await tx.$executeRaw`
    UPDATE "ImportJob"
    SET "fileName" = NULL, "fileSha256" = ''
    WHERE "userId" = ${userId}
      AND ("fileName" IS NOT NULL OR "fileSha256" <> '')
  `

  // 2) NULL raw + normalized JSON on every row of those jobs.
  const rowsScrubbed = await tx.$executeRaw`
    UPDATE "ImportJobRow"
    SET "raw" = NULL, "normalized" = NULL
    WHERE "jobId" IN (SELECT "id" FROM "ImportJob" WHERE "userId" = ${userId})
      AND ("raw" IS NOT NULL OR "normalized" IS NOT NULL)
  `

  // 2b) M11 — DPDP actor-scrub. Every AuditLog row that named the erased
  // principal as the actor is updated to userId=NULL so history survives
  // (audit log is immutable per M5) but the identity linkage is broken.
  // Retention horizon for `invoices.imported_batch`: the row persists as
  // long as the AuditLog row does (currently indefinite — Phase 6 audit
  // retention policy is the SSOT). The scrub here is the DPDP carve-out
  // applied at erasure time; no separate cron retention is owed by 7.1C.
  await tx.$executeRaw`
    UPDATE "AuditLog"
    SET "userId" = NULL
    WHERE "userId" = ${userId}
  `

  const result: EraseImportDataResult = {
    jobsScrubbed: Number(jobsScrubbed),
    rowsScrubbed: Number(rowsScrubbed),
  }

  // 3) Immutable erasure record(s). AuditLog.businessId is a NOT-NULL FK to
  //    Business (onDelete Cascade), so a literal 'SYSTEM' businessId has no
  //    backing row and throws P2003 at insert. Derive the real businesses from
  //    the user's own ImportJobs (the scrub above does not touch businessId) so
  //    the record is FK-valid AND correctly scoped — one record per business
  //    the user imported into. The FK userId column stays NULL (the erased user
  //    is referenced in the payload only, per S9 + the header note); the actor
  //    is recorded via systemActor. Gated on an actual scrub so idempotent
  //    re-runs write no duplicate record.
  if (result.jobsScrubbed > 0 || result.rowsScrubbed > 0) {
    const businesses = await tx.$queryRaw<Array<{ businessId: string }>>`
      SELECT DISTINCT "businessId" FROM "ImportJob" WHERE "userId" = ${userId}
    `
    for (const { businessId } of businesses) {
      await tx.auditLog.create({
        data: {
          businessId,
          userId: null,
          systemActor: 'dpdp-erasure',
          entityType: 'ImportJob',
          entityId: userId,
          action: 'DELETE',
          changes: {
            event: 'import_job.erased',
            jobsScrubbed: result.jobsScrubbed,
            rowsScrubbed: result.rowsScrubbed,
          },
        },
      })
    }
  }

  logger.info('import.erasure.done', { userId, ...result })
  return result
}

// TODO(wiring): when `server/src/services/user-erasure.service.ts`
// lands, call `eraseImportData(userId, tx)` from inside its master
// $transaction BEFORE the User row is deleted (FK Restrict). Tracked
// in design-plan-active.md under "API.7 follow-ups".
