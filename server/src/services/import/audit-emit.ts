// PII: logger / audit calls MUST NOT include raw cell content —
// only jobId, sourceIndex, code, field (S9, ARCHITECTURE_PHASE7_IMPORT §10).
/**
 * Phase 7 — Import Engine · Audit emit helpers (API.7)
 *
 * Centralises every `tx.auditLog.create` (or `prisma.auditLog.create`)
 * call made by the import pipeline. Single-purpose, PII-safe shapes —
 * every helper takes only the minimum fields the manifest contract
 * promises (ARCH §10 + SECURITY_AUDIT S9). Raw row payloads NEVER leak
 * into the audit `changes` blob.
 *
 * Each helper accepts EITHER a $transaction client (`tx`) or the root
 * prisma — both expose `auditLog.create` identically, so we type as
 * the structural surface to keep callers flexible.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §10 (audit coverage)
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md S9 (no raw cell content)
 */

import type { AuthContext } from '../../types/import.types.js'

// Structural — accepts a Prisma client OR a $transaction tx OR a test
// double. We only require `auditLog.create({ data })`. Typed loosely so
// the Prisma client-extension generic doesn't reject the call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AuditWriter {
  auditLog: { create: (args: { data: any }) => Promise<unknown> }
}

type DedupAction = 'SKIP_EXACT' | 'OVERWRITE' | 'CREATE_NEW'

function base(auth: AuthContext, jobId: string, action: string) {
  return {
    businessId: auth.businessId,
    userId: auth.userId,
    entityType: 'ImportJob',
    entityId: jobId,
    action,
  }
}

export async function emitUploaded(
  client: AuditWriter,
  auth: AuthContext,
  args: {
    jobId: string
    format: string
    fileName: string | null
    fileSha256: string
    fileSize: number
  },
): Promise<void> {
  await client.auditLog.create({
    data: {
      ...base(auth, args.jobId, 'CREATE'),
      changes: {
        event: 'import_job.uploaded',
        format: args.format,
        fileName: args.fileName,
        fileSha256: args.fileSha256,
        fileSize: args.fileSize,
      },
    },
  })
}

export async function emitParsed(
  client: AuditWriter,
  auth: AuthContext,
  args: { jobId: string; rowCount: number; errorCount: number; durationMs: number },
): Promise<void> {
  await client.auditLog.create({
    data: {
      ...base(auth, args.jobId, 'UPDATE'),
      changes: {
        event: 'import_job.parsed',
        rowCount: args.rowCount,
        errorCount: args.errorCount,
        durationMs: args.durationMs,
      },
    },
  })
}

export async function emitRowDropped(
  client: AuditWriter,
  auth: AuthContext,
  args: { jobId: string; sourceIndex: number; code: string; field?: string },
): Promise<void> {
  await client.auditLog.create({
    data: {
      ...base(auth, args.jobId, 'UPDATE'),
      changes: {
        event: 'import_job.row_dropped',
        sourceIndex: args.sourceIndex,
        code: args.code,
        field: args.field ?? null,
      },
    },
  })
}

export async function emitDedupResolved(
  client: AuditWriter,
  auth: AuthContext,
  args: {
    jobId: string
    sourceIndex: number
    action: DedupAction
    matchedPartyId?: string | null
  },
): Promise<void> {
  await client.auditLog.create({
    data: {
      ...base(auth, args.jobId, 'UPDATE'),
      changes: {
        event: 'import_job.dedup_resolved',
        sourceIndex: args.sourceIndex,
        action: args.action,
        matchedPartyId: args.matchedPartyId ?? null,
      },
    },
  })
}

export async function emitCommitted(
  client: AuditWriter,
  auth: AuthContext,
  args: {
    jobId: string
    committedCount: number
    skippedCount: number
    errorCount: number
    partyIdsCount: number
  },
): Promise<void> {
  await client.auditLog.create({
    data: {
      ...base(auth, args.jobId, 'UPDATE'),
      changes: {
        event: 'import_job.committed',
        committedCount: args.committedCount,
        skippedCount: args.skippedCount,
        errorCount: args.errorCount,
        partyIdsCount: args.partyIdsCount,
      },
    },
  })
}

/**
 * API.8 — Emit a single batched `parties.updated_from_import` audit row
 * covering every party mutated by an OVERWRITE resolution in this commit.
 * Mirrors `parties.imported_batch` (S6 batched audit): one row per chunk,
 * NOT one per party. PII-safe — only ids and counts cross the wire.
 */
export async function emitPartiesUpdatedFromImport(
  client: AuditWriter,
  args: {
    jobId: string
    businessId: string
    userId: string
    partyIds: string[]
    source?: string
  },
): Promise<void> {
  if (args.partyIds.length === 0) return
  await client.auditLog.create({
    data: {
      businessId: args.businessId,
      userId: args.userId,
      entityType: 'ImportJob',
      entityId: args.jobId,
      action: 'UPDATE',
      changes: {
        event: 'parties.updated_from_import',
        partyIds: args.partyIds,
        partyIdsCount: args.partyIds.length,
        source: args.source ?? 'import-overwrite',
      },
    },
  })
}

/**
 * Phase 7 · 7.1B — batched `products.imported_batch` audit row.
 * One row per chunk (S6); PII-safe — only ids, counts, sourceIndices.
 */
export async function emitProductsImportedBatch(
  client: AuditWriter,
  args: {
    jobId: string
    businessId: string
    userId: string
    productIds: string[]
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
        event: 'products.imported_batch',
        productIds: args.productIds,
        sourceIndices: args.sourceIndices,
        count: args.productIds.length,
      },
    },
  })
}

/**
 * Phase 7 · 7.1B — single batched `products.updated_from_import` row
 * covering every Product mutated by OVERWRITE resolutions in this commit.
 */
export async function emitProductsUpdatedFromImport(
  client: AuditWriter,
  args: {
    jobId: string
    businessId: string
    userId: string
    productIds: string[]
    source?: string
  },
): Promise<void> {
  if (args.productIds.length === 0) return
  await client.auditLog.create({
    data: {
      businessId: args.businessId,
      userId: args.userId,
      entityType: 'ImportJob',
      entityId: args.jobId,
      action: 'UPDATE',
      changes: {
        event: 'products.updated_from_import',
        productIds: args.productIds,
        productIdsCount: args.productIds.length,
        source: args.source ?? 'import-overwrite',
      },
    },
  })
}

// 7.1C — `emitInvoicesImportedBatch` extracted to audit-emit-invoices.ts
// to keep this file under the 250L cap. Re-export for back-compat with
// audit-coverage scanner (which greps SOURCE_REGISTRY for the symbol).
export { emitInvoicesImportedBatch } from './audit-emit-invoices.js'

export async function emitExpired(
  client: AuditWriter,
  args: { businessId: string; userId: string; jobId: string; expiredAt: Date },
): Promise<void> {
  await client.auditLog.create({
    data: {
      businessId: args.businessId,
      userId: args.userId,
      entityType: 'ImportJob',
      entityId: args.jobId,
      action: 'UPDATE',
      changes: {
        event: 'import_job.expired',
        expiredAt: args.expiredAt.toISOString(),
      },
    },
  })
}

export async function emitParseTimeout(
  client: AuditWriter,
  args: { businessId: string; userId: string; jobId: string },
): Promise<void> {
  await client.auditLog.create({
    data: {
      businessId: args.businessId,
      userId: args.userId,
      entityType: 'ImportJob',
      entityId: args.jobId,
      action: 'UPDATE',
      changes: { event: 'import_job.parse_timeout', code: 'PARSE_TIMEOUT' },
    },
  })
}
