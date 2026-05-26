/**
 * Phase 7 — Import lifecycle audit emitters (expired / parse_timeout).
 * Split from audit-emit.ts to keep that file ≤250L (PR-W4 stabilization).
 * PII-safe: only jobId + event code crosses the wire.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AuditWriter {
  auditLog: { create: (args: { data: any }) => Promise<unknown> }
}

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
