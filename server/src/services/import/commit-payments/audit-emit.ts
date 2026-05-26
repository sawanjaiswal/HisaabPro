// PII: logger / audit calls MUST NOT include raw cell content —
// only jobId, sourceIndex, code (S9, ARCHITECTURE_PHASE7_IMPORT §10).
/**
 * Phase 7 · 7.1D PR-D3 — Payment-specific batched audit emit.
 *
 * Mirrors `audit-emit-invoices.ts`: single `auditLog.create` per chunk
 * (S6) with PII-minimal parallel arrays. The only fields that cross the
 * wire are `paymentIds`, `sourceIndices`, and per-row `codes`. NEVER
 * `partyId`, `amount`, `referenceNumber`, or `invoiceNumber` — those
 * leak into the audit ledger and break SECURITY_AUDIT S9.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1D.md §6, §10
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md S9 (PII-safe audit)
 */

import { assertEqualLengths } from '../audit-emit.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AuditWriter {
  auditLog: { create: (args: { data: any }) => Promise<unknown> }
}

export interface PaymentBatchAuditArgs {
  jobId: string
  businessId: string
  userId: string
  /** Payment.id values for COMMITTED rows in this chunk. */
  paymentIds: string[]
  /** Per-row source row index from the staged file. */
  sourceIndices: number[]
  /**
   * Per-row terminal status code: 'COMMITTED' | 'OVER_ALLOCATION'
   * | 'INVOICE_NOT_FOUND' | 'DUPLICATE_SKIPPED' | 'PAYMENT_MODE_INVALID'
   * | 'CONCURRENT_COMMIT_RACE' | ... . Same length as paymentIds (empty
   * string for non-committed rows so the arrays stay aligned).
   */
  codes: string[]
}

/**
 * Emit one batched `payments.imported_batch` audit row covering every
 * staged-payment row processed by this chunk. Skips emit if zero rows
 * (matches `commitChunkParties` and invoice emit behaviour).
 */
export async function emitPaymentsImportedBatch(
  client: AuditWriter,
  args: PaymentBatchAuditArgs,
): Promise<void> {
  if (args.sourceIndices.length === 0) return
  // S9 — refuse mis-shaped batches BEFORE writing. A drift between
  // paymentIds / sourceIndices / codes silently corrupts replay; better
  // to throw inside the tx and roll back than to write a corrupt audit.
  assertEqualLengths({
    paymentIds: args.paymentIds,
    sourceIndices: args.sourceIndices,
    codes: args.codes,
  })

  await client.auditLog.create({
    data: {
      businessId: args.businessId,
      userId: args.userId,
      entityType: 'ImportJob',
      entityId: args.jobId,
      action: 'CREATE',
      changes: {
        event: 'payments.imported_batch',
        paymentIds: args.paymentIds,
        sourceIndices: args.sourceIndices,
        codes: args.codes,
        count: args.sourceIndices.length,
      },
    },
  })
}
