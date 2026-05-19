// PII: logger / audit calls MUST NOT include raw cell content —
// only jobId, sourceIndex, code, field (S9, ARCHITECTURE_PHASE7_IMPORT §10).
/**
 * Phase 7 · 7.1C PR-C3 — Invoice batched audit emit helper.
 *
 * Extracted from audit-emit.ts to keep that file under the 250L cap
 * while the rest of the legacy debt is refactored separately. Single
 * `tx.auditLog.create` per chunk (ARCH S1) with PII-minimal parallel
 * arrays — no raw row payloads (SECURITY_AUDIT S9).
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §10 (audit coverage)
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md S9 (no raw cell content)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AuditWriter {
  auditLog: { create: (args: { data: any }) => Promise<unknown> }
}

export async function emitInvoicesImportedBatch(
  client: AuditWriter,
  args: {
    jobId: string
    businessId: string
    userId: string
    documentIds: string[]
    documentNumbers: string[]
    partyIds: string[]
    grandTotals: number[]
    sourceIndices: number[]
  },
): Promise<void> {
  await client.auditLog.create({
    data: {
      businessId: args.businessId,
      userId: args.userId,
      entityType: 'ImportJob',
      entityId: args.jobId,
      action: 'CREATE',
      changes: {
        event: 'invoices.imported_batch',
        documentIds: args.documentIds,
        documentNumbers: args.documentNumbers,
        partyIds: args.partyIds,
        grandTotals: args.grandTotals,
        sourceIndices: args.sourceIndices,
        count: args.documentIds.length,
      },
    },
  })
}
