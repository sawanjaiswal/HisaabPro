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

/** Per-row dedup decision sent to the commit endpoint (API.8). */
export interface DedupResolutionWire {
  rowId: string
  decision: 'SKIP' | 'OVERWRITE' | 'CREATE_NEW'
}

/** Request body for POST /api/imports/:id/commit. `idempotencyKey` is
 *  carried as an HTTP header by the service — kept in the request type
 *  so the hook generates it once and the service threads it. */
export interface CommitImportReq {
  commitToken: string
  idempotencyKey: string
  dedupResolutions?: DedupResolutionWire[]
}

/** Response from POST /api/imports/:id/commit. Mirrors
 *  `CommitResult` returned by services/import/commit.service.ts. */
export interface CommitImportRes {
  committedCount: number
  skippedCount: number
  errorCount: number
  createdPartyIds: string[]
  overwrittenPartyIds: string[]
  partial: boolean
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
