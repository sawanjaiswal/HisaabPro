/**
 * Phase 7 — Import Engine shared types
 *
 * Derived from constants/import.constants.ts so a new format/status only
 * needs to be added in one place. Consumed by parsers, services, routes,
 * and tests. No runtime — type-only file.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md File Plan row 2
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M1 (AuthContext helper)
 */

import type {
  IMPORT_FORMATS,
  IMPORT_JOB_STATUSES,
  IMPORT_ROW_STATUSES,
  DEDUP_ACTIONS,
} from '../constants/import.constants.js'

// ── Derived string-literal unions ────────────────────────────────────
export type ImportFormat = typeof IMPORT_FORMATS[number]
export type ImportJobStatus = typeof IMPORT_JOB_STATUSES[number]
export type ImportRowStatus = typeof IMPORT_ROW_STATUSES[number]
export type DedupAction = typeof DEDUP_ACTIONS[number]

// ── Row-level issue surfaced to preview UI ───────────────────────────
export interface RowIssue {
  /** Field on the normalized row that triggered the issue. */
  field: string
  /** Machine-readable code (e.g. INVALID_PHONE, MISSING_NAME). */
  code: string
  /** Human-readable message localized server-side. */
  message: string
}

// ── Parser surface ───────────────────────────────────────────────────
/**
 * One raw row as emitted by a format-specific parser. `sourceIndex` is
 * the 0-based index inside the source file (used for stable ordering
 * and for error messages that reference "row N").
 */
export interface RawPartyRow {
  sourceIndex: number
  raw: Record<string, string>
}

/**
 * One normalized party row ready for dedup + commit. All fields use
 * canonical HP representations (E.164 phone, paise integers, etc.).
 * `issues[]` may be non-empty even when other fields are present — the
 * preview UI shows the row with inline error chips.
 */
export interface NormalizedPartyRow {
  name: string
  phoneE164?: string
  email?: string
  gstin?: string
  address?: string
  openingBalancePaise?: number
  issues: RowIssue[]
}

/**
 * Result returned by a parser implementation. `rejectedReason` is
 * populated only when the entire file was rejected (e.g. zip bomb,
 * XXE attempt, unparseable header) — in which case `rows` is empty.
 */
export interface ParserResult {
  rows: RawPartyRow[]
  rowCount: number
  rejectedCount: number
  rejectedReason?: string
}

// ── Dedup resolution input (API.8) ───────────────────────────────────
/**
 * Per-row decision captured by the preview UI for DUPLICATE_* rows.
 * `decision`:
 *   - SKIP        no-op; row stays DUPLICATE_* (naturally excluded from commit)
 *   - OVERWRITE   update matched party from row's normalized data
 *   - CREATE_NEW  flip row to STAGED + null matchedPartyId (treat as new party)
 *
 * Validated by `dedupResolutionSchema` (server/src/schemas/import.zod.ts).
 */
export type DedupResolutionDecision = 'SKIP' | 'OVERWRITE' | 'CREATE_NEW'

export interface DedupResolution {
  rowId: string
  decision: DedupResolutionDecision
}

// ── Auth helper return shape (M1) ────────────────────────────────────
/**
 * Output of `lib/auth-helper.ts#getAuth(req)`. Guarantees both ids
 * are non-empty strings so downstream code never has to re-check.
 * Bypassing this helper is what introduced the cross-tenant IDOR
 * (see MEMORY.md > feedback_auth_req_user_shape).
 */
export interface AuthContext {
  userId: string
  businessId: string
}

// ── Public view DTO surfaced to clients ──────────────────────────────
/**
 * Shape returned by GET /import/jobs/:id and friends. Note `commitToken`
 * is only present once the job reaches PREVIEWED and is consumed by the
 * commit endpoint to make the operation idempotent under retries.
 */
export interface ImportJobView {
  id: string
  status: ImportJobStatus
  format: ImportFormat
  fileName: string | null
  rowCount: number
  errorCount: number
  commitToken?: string
  createdAt: string
  updatedAt: string
}
