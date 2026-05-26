/**
 * Phase 7 · 7.1D PR-D3 — Per-row payment allocation ladder.
 *
 * Ladder (in tx, sequential — NEVER Promise.all):
 *
 *   1. Resolve invoiceNumber → Document.id (businessId scoped). If
 *      NOT_FOUND → mark row COMMIT_BLOCKED_INVOICE_NOT_FOUND.
 *   2. assertPaymentMode (M9) — fail-fast on unknown enum.
 *   3. assertNoOverAllocation (SELECT FOR UPDATE on Document + Σ).
 *      → OVER_ALLOCATION marks row ERROR; no Payment row created.
 *   4. INSERT Payment (importJobId, importedBy provenance).
 *   5. INSERT PaymentAllocation (if invoice resolved). NO_INVOICE
 *      → Payment created, allocation skipped (un-applied receipt).
 *   6. UPDATE ImportJobRow row-level guard (status='STAGED'
 *      AND createdEntityId IS NULL) → CONCURRENT_COMMIT_RACE if 0.
 *
 * The function returns an `AllocateRowOutcome` discriminated union;
 * the orchestrator translates that into per-row status + audit codes.
 * Errors that should ABORT the chunk (e.g. unexpected Prisma 5xx) are
 * re-thrown; row-local conditions (OVER_ALLOCATION etc.) are returned
 * as { skipped: true }.
 *
 * Dual-shape P2002 handling: Prisma exposes `error.meta.target` as
 * either `string` (Postgres column name) or `string[]` (compound).
 * BOTH shapes must be handled — `target.includes(...)` vs
 * `target === '...'` — otherwise a future Prisma upgrade silently
 * disables the dedup branch.
 *
 * Authority:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1D.md §6
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md M9, S5, S9
 */

import logger from '../../../lib/logger.js'
import { AppError, ErrorCode } from '../../../lib/errors.js'
import type { Tx } from '../commit.helpers.js'
import type { NormalizedPayment } from './types.js'
import { assertPaymentMode } from './enum-guard.js'
import { assertNoOverAllocation } from './over-allocation-guard.js'
import { PaymentInvoiceResolver } from './payment-invoice-resolver.js'

export type AllocateOutcomeCode =
  | 'COMMITTED'
  | 'COMMIT_BLOCKED_INVOICE_NOT_FOUND'
  | 'OVER_ALLOCATION'
  | 'ALLOCATION_INTERNAL_CONFLICT'
  | 'PAYMENT_MODE_INVALID'
  | 'CONCURRENT_COMMIT_RACE'
  | 'DUPLICATE_SKIPPED'

export interface AllocateRowOutcome {
  code: AllocateOutcomeCode
  paymentId: string | null
}

export interface AllocateRowArgs {
  tx: Tx
  resolver: PaymentInvoiceResolver
  businessId: string
  userId: string
  jobId: string
  rowId: string
  normalized: NormalizedPayment
}

/**
 * Default payment.type when caller does not provide one. 7.1D imports
 * are PAYMENT_IN (receipts FROM party). PAYMENT_OUT imports are
 * tracked under a separate 7.2 epic.
 */
const DEFAULT_PAYMENT_TYPE = 'PAYMENT_IN'

export async function allocateOnePayment(
  args: AllocateRowArgs,
): Promise<AllocateRowOutcome> {
  const { tx, resolver, businessId, userId, jobId, rowId, normalized } = args

  // 1. Resolve invoice (businessId scoped).
  const inv = await resolver.resolve(normalized)
  if (inv.status === 'NOT_FOUND') {
    await markRowError(tx, rowId, 'COMMIT_BLOCKED_INVOICE_NOT_FOUND')
    return { code: 'COMMIT_BLOCKED_INVOICE_NOT_FOUND', paymentId: null }
  }

  // 2. M9 enum guard (defense in depth).
  try {
    assertPaymentMode(normalized.mode)
  } catch (e) {
    if (e instanceof AppError && e.code === ErrorCode.PAYMENT_MODE_INVALID) {
      await markRowError(tx, rowId, 'PAYMENT_MODE_INVALID')
      return { code: 'PAYMENT_MODE_INVALID', paymentId: null }
    }
    throw e
  }

  // 3. Σ guard (only when allocating — un-applied payments skip).
  if (inv.status === 'RESOLVED') {
    try {
      await assertNoOverAllocation({
        tx,
        invoiceId: inv.invoiceId,
        businessId,
        amountPaise: normalized.amountPaise,
      })
    } catch (e) {
      if (e instanceof AppError && e.code === ErrorCode.OVER_ALLOCATION) {
        await markRowError(tx, rowId, 'OVER_ALLOCATION')
        return { code: 'OVER_ALLOCATION', paymentId: null }
      }
      if (e instanceof AppError && e.code === ErrorCode.INVOICE_NOT_FOUND) {
        await markRowError(tx, rowId, 'COMMIT_BLOCKED_INVOICE_NOT_FOUND')
        return { code: 'COMMIT_BLOCKED_INVOICE_NOT_FOUND', paymentId: null }
      }
      if (
        e instanceof AppError &&
        e.code === ErrorCode.ALLOCATION_INTERNAL_CONFLICT
      ) {
        await markRowError(tx, rowId, 'ALLOCATION_INTERNAL_CONFLICT')
        return { code: 'ALLOCATION_INTERNAL_CONFLICT', paymentId: null }
      }
      throw e
    }
  }

  // 4. INSERT Payment. Caller has resolved partyId upstream — if null,
  //    the row should already have been marked ERROR by the normalizer.
  if (!normalized.partyId) {
    await markRowError(tx, rowId, 'COMMIT_BLOCKED_INVOICE_NOT_FOUND')
    return { code: 'COMMIT_BLOCKED_INVOICE_NOT_FOUND', paymentId: null }
  }

  let paymentId: string
  try {
    const created = await tx.payment.create({
      data: {
        businessId,
        type: DEFAULT_PAYMENT_TYPE,
        partyId: normalized.partyId,
        amount: normalized.amountPaise,
        date: new Date(normalized.date),
        mode: normalized.mode as string,
        referenceNumber: normalized.referenceNumber,
        notes: normalized.notes,
        createdBy: userId,
        importJobId: jobId,
        importedBy: userId,
      },
      select: { id: true },
    })
    paymentId = created.id
  } catch (e) {
    // Dual-shape P2002 — handle both string and string[] target shapes.
    if (isP2002(e)) {
      await markRowError(tx, rowId, 'DUPLICATE_SKIPPED')
      return { code: 'DUPLICATE_SKIPPED', paymentId: null }
    }
    throw e
  }

  // 5. INSERT PaymentAllocation if invoice resolved.
  if (inv.status === 'RESOLVED') {
    await tx.paymentAllocation.create({
      data: {
        paymentId,
        invoiceId: inv.invoiceId,
        amount: normalized.amountPaise,
      },
      select: { id: true },
    })
  }

  // 6. Row-level guard — only bind if still STAGED.
  const claimed = await tx.importJobRow.updateMany({
    where: { id: rowId, status: 'STAGED', createdEntityId: null },
    data: { status: 'COMMITTED', createdEntityId: paymentId },
  })
  if (claimed.count !== 1) {
    // S9 — log id only, no row payload.
    logger.warn('import.payment.commit_race', { rowId, jobId })
    return { code: 'CONCURRENT_COMMIT_RACE', paymentId }
  }
  return { code: 'COMMITTED', paymentId }
}

async function markRowError(
  tx: Tx,
  rowId: string,
  code: AllocateOutcomeCode,
): Promise<void> {
  // Append a commit-time issue rather than overwrite the parse-time
  // ones — preserves the full diagnostic chain for the FE row drawer.
  // Raw JSON arr-append via Prisma's `set` would overwrite; use raw
  // SQL to push. ImportJobRow.issues default is '[]' so the col is
  // always a JSON array.
  await tx.$executeRaw`
    UPDATE "ImportJobRow"
    SET status = 'ERROR',
        issues = COALESCE(issues, '[]'::jsonb)
                 || jsonb_build_array(jsonb_build_object(
                      'field', NULL,
                      'code', ${code}::text,
                      'severity', 'ERROR',
                      'message', ${code}::text
                    ))
    WHERE id = ${rowId} AND status = 'STAGED'
  `
}

/**
 * Prisma P2002 unique-constraint detector. Handles BOTH `target` shapes:
 *   - `string` (older Prisma — single column or comma-joined name)
 *   - `string[]` (current Prisma — composite key)
 */
function isP2002(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: unknown; meta?: { target?: unknown } }
  if (e.code !== 'P2002') return false
  // We do not currently key off the specific target — any P2002 on a
  // Payment INSERT means an idempotency / dedup collision. Inspect
  // shape only to confirm Prisma's contract is still what we expect.
  const t = e.meta?.target
  return typeof t === 'string' || Array.isArray(t) || t === undefined
}
