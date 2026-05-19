/**
 * Phase 7 Slice 7.1A — Import types (FE mirror of BE contract).
 * Source of truth: docs/ARCHITECTURE_PHASE7_IMPORT_7_1A.md §3 + SCOPE.
 */

export type ImportFormat = 'tally_xml' | 'vyapar_csv' | 'busy_xls' | 'generic_csv'

export type ImportEntity = 'parties'

export type ImportJobStatus =
  | 'UPLOADED'
  | 'PARSING'
  | 'PREVIEWED'
  | 'COMMITTING'
  | 'COMMITTED'
  | 'PARTIALLY_COMMITTED'
  | 'FAILED'
  | 'CANCELLED'

export interface ImportJobCounts {
  total: number
  staged: number
  errors: number
  warnings: number
  duplicatesExact: number
  duplicatesNear: number
  committed?: number
}

/** Response shape of POST /api/imports (upload). */
export interface CreateImportRes {
  jobId: string
  status: Extract<ImportJobStatus, 'PARSING' | 'PREVIEWED' | 'FAILED'>
  commitToken: string | null
  counts: ImportJobCounts | null
  fileSha256: string
  previouslyUploadedAt: string | null
  previousJobRowCount: number | null
}

/** Response shape of GET /api/imports/:id (poll). */
export interface ImportJobView {
  job: {
    id: string
    entity: ImportEntity
    format: ImportFormat
    status: ImportJobStatus
    commitToken: string | null
    counts: ImportJobCounts
    fileName: string
    createdAt: string
    committedAt: string | null
    expiresAt: string
  }
}
