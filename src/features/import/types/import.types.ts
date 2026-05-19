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

/** Preview row shape (mirrors server `PreviewRow` — API.5). */
export interface ImportPreviewRow {
  id: string
  sourceIndex: number
  status: 'STAGED' | 'ERROR' | 'WARNING' | 'DUPLICATE_EXACT' | 'DUPLICATE_NEAR' | 'COMMITTED' | 'SKIPPED'
  raw: Record<string, unknown>
  normalized: Record<string, unknown>
  issues: unknown
  matchedPartyId: string | null
  createdPartyId: string | null
}

/** Response shape of GET /api/imports/:id (poll). Mirrors server
 *  `GetImportJobResult` in services/import/get.service.ts. */
export interface ImportJobView {
  job: {
    id: string
    status: ImportJobStatus
    format: ImportFormat
    fileName: string | null
    rowCount: number
    errorCount: number
    counts: ImportJobCounts | null
    createdAt: string
    updatedAt: string
    committedAt: string | null
  }
  rows: ImportPreviewRow[]
  nextCursor: string | null
}
