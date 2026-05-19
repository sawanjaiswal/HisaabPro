/**
 * Phase 7 — Import Engine constants
 *
 * SSOT for all magic numbers, format enums, status enums, and security
 * caps used by the import upload → parse → preview → commit pipeline.
 *
 * Cross-references:
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md S2 (fast-xml-parser pin —
 *     CVE-2024-41818 prototype-pollution fix landed in 4.4.0)
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md S8 (MAX_CREATED_PARTY_IDS
 *     bounds the in-memory rollback set so a commit cannot OOM the box)
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md File Plan rows 1-6
 */

// ── Parser limits ────────────────────────────────────────────────────
/** Max rows processed synchronously in the upload request thread. */
export const SYNC_PARSE_CAP = 2000
/** Hard upper bound on uploaded file size (multer rejects beyond). */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
/** Hard upper bound on row count after parsing (reject job otherwise). */
export const MAX_ROWS = 10000
/** XXE / billion-laughs scan window — full buffer per S1 audit fix. */
export const XXE_SCAN_BYTES = 10 * 1024 * 1024 // 10 MB
/** Max uncompressed payload accepted from an XLSX zip (zip-bomb guard). */
export const XLSX_MAX_UNCOMPRESSED = 100 * 1024 * 1024 // 100 MB
/** Max compression ratio (uncompressed / compressed) before reject. */
export const XLSX_MAX_RATIO = 100
/** Hard wall-clock cap for parser execution (per file). */
export const PARSE_TIMEOUT_MS = 10_000

// ── Commit pipeline ──────────────────────────────────────────────────
/** Rows committed per DB transaction inside a single import job. */
export const CHUNK_SIZE = 500
/** S8 — max created-party ids retained for rollback bookkeeping. */
export const MAX_CREATED_PARTY_IDS = 10_000
/**
 * API.8 — upper bound on per-row dedup resolutions accepted in the commit
 * payload. Mirrors MAX_ROWS so the worst case is still bounded. Beyond this
 * the request is rejected at the zod layer before any DB work.
 */
export const MAX_DEDUP_RESOLUTIONS = MAX_ROWS

// ── Retention / reaping ──────────────────────────────────────────────
/** Hours after which raw uploaded payloads are purged from storage. */
export const RAW_RETENTION_HOURS = 24
/** Jobs stuck in PARSING longer than this are reaped to FAILED. */
export const ORPHAN_PARSING_REAP_MIN = 5

// ── Rate limits & lockouts ───────────────────────────────────────────
export const IMPORT_RATE_UPLOAD_PER_HOUR = 5
export const IMPORT_RATE_UPLOAD_PER_DAY = 20
/** Failed uploads within window before lockout engages. */
export const IMPORT_LOCKOUT_FAILED_THRESHOLD = 3
export const IMPORT_LOCKOUT_WINDOW_MIN = 10
export const IMPORT_LOCKOUT_COOLDOWN_MIN = 60

// ── Client compatibility ─────────────────────────────────────────────
/** Minimum HP client version that speaks the 7.1 import contract. */
export const IMPORT_MIN_CLIENT_VERSION = '7.1.0'

// ── Library pins (S2) ────────────────────────────────────────────────
/**
 * fast-xml-parser must be ≥ 4.4.0 — earlier releases are vulnerable to
 * CVE-2024-41818 (prototype-pollution via crafted XML). Verified at
 * boot by lib/env.ts (or equivalent guard) using this constant.
 */
export const FAST_XML_PARSER_MIN_VERSION = '4.4.0'

// ── Format & status enums (as const for type inference) ──────────────
export const IMPORT_FORMATS = [
  'TALLY_XML',
  'VYAPAR_CSV',
  'BUSY_XLSX',
  'GENERIC_CSV',
] as const

export const IMPORT_JOB_STATUSES = [
  'UPLOADED',
  'PARSING',
  'PREVIEWED',
  'COMMITTING',
  'COMMITTED',
  'PARTIALLY_COMMITTED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
] as const

export const IMPORT_ROW_STATUSES = [
  'STAGED',
  'COMMITTED',
  'SKIPPED',
  'ERROR',
] as const

export const DEDUP_ACTIONS = [
  'NONE',
  'SKIP_EXACT',
  'OVERWRITE',
  'CREATE_NEW',
] as const

// ─────────────────────────────────────────────────────────────────────
// Phase 7 · Slice 7.1B — PRODUCTS IMPORT (additive only)
// ─────────────────────────────────────────────────────────────────────

// ── Price (money) regex + caps (SCOPE L295-340) ──────────────────────
/** Raw decimal string: 1-12 integer digits, ≤2 fractional. */
export const PRICE_PRECISION_REGEX = /^\d{1,12}(\.\d{0,2})?$/
/** Detects >2 fractional digits → WARNING PRICE_PRECISION_LOST. */
export const PRICE_PRECISION_LOST_REGEX = /^\d{1,12}\.\d{3,}$/
/** Strip Indian comma grouping ("1,23,456.78") before regex test. */
export const PRICE_COMMA_STRIP = /,/g
/** Safety-net upper bound mirrors regex (≤ MAX_SAFE_INTEGER paise). */
export const PRICE_MAX_PAISE = BigInt(Number.MAX_SAFE_INTEGER)

// ── Product field caps (SCOPE L160-168 + M6/M7) ──────────────────────
export const SKU_MAX_LEN = 64
export const UNIT_MAX_LEN = 64
export const HSN_CHARSET_REGEX = /^[0-9]+$/
export const HSN_VALID_LENGTHS = new Set([4, 6, 8])
export const DESCRIPTION_MAX_LEN = 2000
export const PRODUCT_PLACEHOLDER_NAMES = new Set([
  'item 1',
  'item',
  'product',
  '-',
  'n/a',
  'test',
  'sample',
  'new item',
  'product 1',
])

// ── Dedup ────────────────────────────────────────────────────────────
export const TRGM_THRESHOLD = 0.7
export const TRGM_TOP_K = 5

// ── Audit (PII-safe events) ──────────────────────────────────────────
export const ACTION_PRODUCTS_IMPORTED_BATCH = 'products.imported_batch' as const
export const ACTION_PRODUCTS_UPDATED_FROM_IMPORT =
  'products.updated_from_import' as const
