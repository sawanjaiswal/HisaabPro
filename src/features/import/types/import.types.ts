/**
 * Phase 7 Slice 7.1A — Import types (FE mirror of BE contract).
 * Source of truth: docs/ARCHITECTURE_PHASE7_IMPORT_7_1A.md §3 + SCOPE.
 */

export type ImportFormat = 'tally_xml' | 'vyapar_csv' | 'busy_xls' | 'generic_csv'

export type ImportEntity = 'parties' | 'product' | 'invoice' | 'payments'

/**
 * 7.1C invoice-side issue codes (FE mirror of
 * server/services/import/invoice/invoice.constants.ts → `InvoiceIssueCode`).
 * Severity is fixed by BE — chip colour picked from severity table below.
 */
export type InvoiceIssueCode =
  | 'INVOICE_NUMBER_REQUIRED'
  | 'INVALID_DATE'
  | 'NO_LINES'
  | 'HEADER_MISMATCH_WITHIN_INVOICE'
  | 'PARTY_NOT_FOUND'
  | 'PARTY_AUTO_CREATED'
  | 'PARTY_NAME_ONLY_MATCH'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_AMBIGUOUS'
  | 'TAX_MATH_MISMATCH'
  | 'AMOUNT_OUT_OF_RANGE'
  | 'AMOUNT_NEGATIVE'
  | 'DUPLICATE_EXACT'
  | 'DUPLICATE_INVOICE_NUMBER'
  | 'INTRA_FILE_DUPLICATE'
  | 'LINES_PER_INVOICE_EXCEEDED'

export const INVOICE_ISSUE_SEVERITY: Record<InvoiceIssueCode, 'ERROR' | 'WARNING'> = {
  INVOICE_NUMBER_REQUIRED: 'ERROR',
  INVALID_DATE: 'ERROR',
  NO_LINES: 'ERROR',
  HEADER_MISMATCH_WITHIN_INVOICE: 'ERROR',
  PARTY_NOT_FOUND: 'ERROR',
  PARTY_AUTO_CREATED: 'WARNING',
  PARTY_NAME_ONLY_MATCH: 'WARNING',
  PRODUCT_NOT_FOUND: 'ERROR',
  PRODUCT_AMBIGUOUS: 'ERROR',
  TAX_MATH_MISMATCH: 'WARNING',
  AMOUNT_OUT_OF_RANGE: 'ERROR',
  AMOUNT_NEGATIVE: 'ERROR',
  DUPLICATE_EXACT: 'ERROR',
  DUPLICATE_INVOICE_NUMBER: 'ERROR',
  INTRA_FILE_DUPLICATE: 'ERROR',
  LINES_PER_INVOICE_EXCEEDED: 'ERROR',
}

/** FE mirror of server `ResolvedParty.matchedBy` for chip rendering. */
export type InvoicePartyMatchedBy =
  | 'BY_PHONE'
  | 'BY_NAME_AND_PHONE'
  | 'BY_NAME_ONLY'
  | 'FLY_CREATE'
  | 'NOT_FOUND'

/** FE mirror of server `ResolvedProductLine.matchedBy`. */
export type InvoiceProductMatchedBy = 'BY_SKU' | 'BY_NAME' | 'NOT_FOUND'

/** Wire shape of `row.issues[]` for invoice rows (mirrors BE InvoiceIssue). */
export interface InvoiceIssue {
  field: string | null
  code: InvoiceIssueCode
  severity: 'ERROR' | 'WARNING'
  message: string
  sourceLineIndex?: number
}

/**
 * FE-relevant subset of NormalizedInvoice (BE writes more). Carried inside
 * `row.normalized`. Paise are Int4 (≤ 2_147_483_647 — narrowed BE-side).
 */
export interface NormalizedInvoiceLine {
  source: {
    sourceLineIndex: number
    skuRaw: string | null
    productNameRaw: string | null
    qtyRaw: string | null
    unitRaw: string | null
  }
  resolved: {
    productId: string | null
    matchedBy: InvoiceProductMatchedBy
    source: { sku: string | null; name: string | null }
  }
  qty: number
  ratePaise: number | null
  taxableValuePaise: number | null
  cgstPaise: number | null
  sgstPaise: number | null
  igstPaise: number | null
  lineTotalPaise: number | null
}

export interface NormalizedInvoice {
  documentNumber: string
  documentDate: string // ISO yyyy-mm-dd
  party: {
    partyId: string | null
    matchedBy: InvoicePartyMatchedBy
    source: { name: string; phone: string | null }
  }
  lines: NormalizedInvoiceLine[]
  subtotalPaise: number
  totalCgstPaise: number
  totalSgstPaise: number
  totalIgstPaise: number
  grandTotalPaise: number
  notes: string | null
}

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
