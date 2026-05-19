/**
 * Phase 7 — Import Engine · Job + rows fetch service (API.5)
 *
 * Reads are uploader-scoped (businessId AND userId, S5). Row payloads are
 * passed through `sanitizeForPreviewJson` (S12) before serving so any
 * string cell beginning with =, +, -, @, \t, \r is prefixed with a single
 * quote — defends every consumer (preview UI, error-CSV exporter, even an
 * admin who pastes the JSON into Excel) from formula injection.
 *
 * Cross-references:
 *   - SCOPE_PHASE7_IMPORT_7_1A_PARTIES.md "Preview API"
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md S5, S12
 */

import { AppError, ErrorCode } from '../../lib/errors.js'
import { sanitizeForPreviewJson } from './security/csv-injection.js'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import type {
  AuthContext,
  ImportFormat,
  ImportJobStatus,
  ImportRowStatus,
} from '../../types/import.types.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export interface GetImportJobArgs {
  jobId: string
  auth: AuthContext
  prisma: ExtendedPrismaClient
  rowStatus?: ImportRowStatus
  cursor?: string
  limit?: number
}

export interface PreviewRow {
  id: string
  sourceIndex: number
  status: ImportRowStatus
  raw: Record<string, unknown>
  normalized: Record<string, unknown>
  issues: unknown
  matchedPartyId: string | null
  createdPartyId: string | null
}

export interface GetImportJobResult {
  job: {
    id: string
    status: ImportJobStatus
    format: ImportFormat
    /**
     * Phase 7 · 7.1B/C — discriminator surfaced for FE preview branching.
     * Invoice payloads carry nested-lines shape; FE delegates to
     * `<InvoiceRowCard>` when this is `'invoice'`.
     */
    entity: 'parties' | 'product' | 'invoice'
    fileName: string | null
    rowCount: number
    errorCount: number
    counts: unknown
    createdAt: string
    updatedAt: string
    committedAt: string | null
  }
  rows: PreviewRow[]
  nextCursor: string | null
}

export async function getImportJob(
  args: GetImportJobArgs,
): Promise<GetImportJobResult> {
  const { jobId, auth, prisma, rowStatus, cursor } = args
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT)

  // Uploader-scoped tenancy — both businessId AND userId.
  const job = await prisma.importJob.findFirst({
    where: { id: jobId, businessId: auth.businessId, userId: auth.userId },
    select: {
      id: true,
      status: true,
      format: true,
      entity: true,
      fileName: true,
      rowCount: true,
      errorCount: true,
      counts: true,
      createdAt: true,
      updatedAt: true,
      committedAt: true,
    },
  })
  if (!job) {
    throw new AppError(ErrorCode.NOT_FOUND, 404, 'Import job not found')
  }

  const rowsRaw = await prisma.importJobRow.findMany({
    where: {
      jobId,
      ...(rowStatus ? { status: rowStatus } : {}),
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    orderBy: { id: 'asc' },
    take: limit + 1,
    select: {
      id: true,
      sourceIndex: true,
      status: true,
      raw: true,
      normalized: true,
      issues: true,
      matchedPartyId: true,
      createdPartyId: true,
    },
  })
  const hasMore = rowsRaw.length > limit
  const visible = hasMore ? rowsRaw.slice(0, limit) : rowsRaw

  const rows: PreviewRow[] = visible.map((r) => ({
    id: r.id,
    sourceIndex: r.sourceIndex,
    status: r.status as ImportRowStatus,
    raw: sanitizeForPreviewJson((r.raw ?? {}) as Record<string, unknown>),
    normalized: sanitizeForPreviewJson(
      (r.normalized ?? {}) as Record<string, unknown>,
    ),
    issues: r.issues,
    matchedPartyId: r.matchedPartyId,
    createdPartyId: r.createdPartyId,
  }))

  return {
    job: {
      id: job.id,
      status: job.status as ImportJobStatus,
      format: job.format as ImportFormat,
      entity: (job.entity === 'product'
        ? 'product'
        : job.entity === 'invoice'
          ? 'invoice'
          : 'parties') as 'parties' | 'product' | 'invoice',
      fileName: job.fileName,
      rowCount: job.rowCount,
      errorCount: job.errorCount,
      counts: job.counts,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      committedAt: job.committedAt ? job.committedAt.toISOString() : null,
    },
    rows,
    nextCursor: hasMore && visible.length > 0 ? visible[visible.length - 1]!.id : null,
  }
}
