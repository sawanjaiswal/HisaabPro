/**
 * Phase 7 — Import Engine · List jobs (API.5)
 *
 * Returns the 20 most-recent ImportJobs for THIS user inside THIS business
 * — uploader-scoped per S5. No cross-user list view in 7.1A (admin audit
 * search has the org-wide view via AuditLog).
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import type {
  AuthContext,
  ImportFormat,
  ImportJobStatus,
} from '../../types/import.types.js'

const DEFAULT_LIST_LIMIT = 20

export interface ListImportJobsArgs {
  auth: AuthContext
  prisma: ExtendedPrismaClient
}

export interface ImportJobListItem {
  id: string
  status: ImportJobStatus
  format: ImportFormat
  fileName: string | null
  rowCount: number
  errorCount: number
  createdAt: string
  committedAt: string | null
}

export async function listImportJobs(
  args: ListImportJobsArgs,
): Promise<ImportJobListItem[]> {
  const { auth, prisma } = args
  const rows = await prisma.importJob.findMany({
    where: { businessId: auth.businessId, userId: auth.userId },
    orderBy: { createdAt: 'desc' },
    take: DEFAULT_LIST_LIMIT,
    select: {
      id: true,
      status: true,
      format: true,
      fileName: true,
      rowCount: true,
      errorCount: true,
      createdAt: true,
      committedAt: true,
    },
  })
  return rows.map((r) => ({
    id: r.id,
    status: r.status as ImportJobStatus,
    format: r.format as ImportFormat,
    fileName: r.fileName,
    rowCount: r.rowCount,
    errorCount: r.errorCount,
    createdAt: r.createdAt.toISOString(),
    committedAt: r.committedAt ? r.committedAt.toISOString() : null,
  }))
}
