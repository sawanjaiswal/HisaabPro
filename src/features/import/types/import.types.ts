/**
 * Phase 7 Slice 7.1A — Import types (FE mirror of BE contract).
 * Source of truth: docs/ARCHITECTURE_PHASE7_IMPORT_7_1A.md §3 + SCOPE.
 */

/**
 * The literals the server's zod enum accepts (`IMPORT_FORMATS` in
 * server/src/constants/import.constants.ts). The upload body schema is
 * `.strict()`, so a lowercase spelling here is not a cosmetic difference — it
 * is a 400 on every upload the wizard makes.
 */
export type ImportFormat = 'TALLY_XML' | 'VYAPAR_CSV' | 'BUSY_XLSX' | 'GENERIC_CSV'

export type ImportEntity = 'parties' | 'product' | 'invoice' | 'payments'

export type {
  InvoiceIssueCode,
  InvoicePartyMatchedBy,
  InvoiceProductMatchedBy,
  InvoiceIssue,
  NormalizedInvoiceLine,
  NormalizedInvoice,
} from './import-invoice.types'
export { INVOICE_ISSUE_SEVERITY } from './import-invoice.types'

/**
 * 409 `COMMIT_BLOCKED_PRODUCT_NOT_FOUND` payload (ApiError.detail.items
 * or .detail). Surfaces missing SKU sample to the CommitBlockedBanner.
 */
export interface CommitBlockedProductDetail {
  blockedRowCount: number
  missingSkuSample: string[]
}

/**
 * 7.1B product-side normalized row shape (carried inside `row.normalized`).
 * Prices arrive as JSON strings (server uses BigInt(paise) and serialises
 * via `String(b)` to dodge JSON's no-BigInt limit — see SECURITY_AUDIT M5).
 * Decimal(18,3) opening-stock also rides as a string for precision.
 */
export interface ProductNormalized {
  name: string
  sku: string | null
  hsnCode: string | null
  mrp: string | null
  salePrice: string | null
  purchasePrice: string | null
  gstRateResolved: number | null
  unitId: string | null
  unitSourceText: string | null
  openingStock: string
  description: string | null
}

/** Product preview row (specialises `ImportPreviewRow.normalized`). */
export interface ProductPreviewRow extends Omit<ImportPreviewRow, 'normalized'> {
  normalized: ProductNormalized & Record<string, unknown>
}

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
/**
 * Exactly what `POST /api/imports` answers with — see
 * server/src/routes/imports/create.route.ts. `api<T>()` asserts this type
 * rather than checking it, so anything invented here fails silently at
 * runtime: this shape must stay a mirror of the route, not a wish.
 *
 * `existing: true` means the same user re-uploaded identical bytes inside the
 * retention window; `job` is then the PREVIOUS job, already parsed.
 */
export interface CreateImportRes {
  job: {
    id: string
    status: ImportJobStatus
    format: ImportFormat
    fileName: string | null
    rowCount: number
    errorCount: number
    /** Only present once the file has been parsed (status PREVIEWED). */
    commitToken?: string | null
  }
  existing: boolean
  previousJobId?: string
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
    /** 7.1B: which kind of records this job carries. */
    entity: ImportEntity
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
