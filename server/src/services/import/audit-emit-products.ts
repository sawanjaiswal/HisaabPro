/**
 * Phase 7 · 7.1B — products audit emitters (batched + overwrite).
 * Split from audit-emit.ts to keep that file ≤250L.
 * PII-safe: only ids + counts + sourceIndices.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AuditWriter {
  auditLog: { create: (args: { data: any }) => Promise<unknown> }
}

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
