/**
 * Error codes and the wire shape they travel in.
 *
 * Split out of errors.ts as its constants layer: the enum is the contract every
 * client switches on, while errors.ts holds the constructors and the Prisma
 * normalization that use it. Import from errors.ts — it re-exports both.
 */

export enum ErrorCode {
  // Validation (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  PHONE_INVALID = 'PHONE_INVALID',
  INVALID_DATE_FORMAT = 'INVALID_DATE_FORMAT',
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',

  // Auth (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',

  // Not Found (404)
  NOT_FOUND = 'NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  PARTY_NOT_FOUND = 'PARTY_NOT_FOUND',
  INVOICE_NOT_FOUND = 'INVOICE_NOT_FOUND',
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND',
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND', // 404
  TEMPLATE_LIMIT_REACHED = 'TEMPLATE_LIMIT_REACHED', // 400
  TEMPLATE_IS_DEFAULT = 'TEMPLATE_IS_DEFAULT', // 400

  // Epic D PR1 — see docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §3.6 / SECURITY_AUDIT M3/M4/S2/NEW_S1/S2
  STAFF_NOT_FOUND = 'STAFF_NOT_FOUND',
  COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT = 'COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT',
  INVALID_WITHIN_DAYS_RANGE = 'INVALID_WITHIN_DAYS_RANGE',
  PARTY_NOT_IN_TENANT = 'PARTY_NOT_IN_TENANT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Business Logic (422)
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  DOCUMENT_LOCKED = 'DOCUMENT_LOCKED',
  CONVERSION_NOT_ALLOWED = 'CONVERSION_NOT_ALLOWED',

  // Phase 6 — Staff & HR (M8 + tenancy + PIN closures; ARCHITECTURE §6.2)
  // 400 — public payment-create rejected for payroll types (single rejection path)
  INVALID_PAYMENT_TYPE = 'INVALID_PAYMENT_TYPE',
  // 400 — POST /api/parties rejected for type='STAFF' (M7 server-create-only)
  INVALID_PARTY_TYPE = 'INVALID_PARTY_TYPE',
  // 403 — requireRecentPin gate: missing/expired/tampered pin_gate_grace cookie
  PIN_REQUIRED = 'PIN_REQUIRED',
  // 403 — requireActiveBusiness gate failures
  NO_BUSINESS = 'NO_BUSINESS',
  NO_MEMBERSHIP = 'NO_MEMBERSHIP',
  MEMBER_SUSPENDED = 'MEMBER_SUSPENDED',
  FIRM_SUSPENDED = 'FIRM_SUSPENDED',
  // 409 — payroll state-machine violations
  PAYROLL_ALREADY_FINALIZED = 'PAYROLL_ALREADY_FINALIZED',
  PAYROLL_ALREADY_REVERSED = 'PAYROLL_ALREADY_REVERSED',
  PAYROLL_PERIOD_OVERLAP = 'PAYROLL_PERIOD_OVERLAP',
  // 423 — PIN lockout (per device, per phone)
  PIN_LOCKED_DEVICE = 'PIN_LOCKED_DEVICE',
  PIN_LOCKED_PHONE = 'PIN_LOCKED_PHONE',

  // Coupon (400)
  COUPON_NOT_FOUND = 'COUPON_NOT_FOUND',
  COUPON_EXPIRED = 'COUPON_EXPIRED',
  COUPON_EXHAUSTED = 'COUPON_EXHAUSTED',
  COUPON_ALREADY_USED = 'COUPON_ALREADY_USED',
  COUPON_INACTIVE = 'COUPON_INACTIVE',
  COUPON_NOT_STARTED = 'COUPON_NOT_STARTED',
  COUPON_PLAN_MISMATCH = 'COUPON_PLAN_MISMATCH',
  COUPON_MIN_AMOUNT = 'COUPON_MIN_AMOUNT',
  // Storefront slug (400 / 409)
  INVALID_SLUG = 'INVALID_SLUG',
  RESERVED_SLUG = 'RESERVED_SLUG',
  SLUG_TAKEN = 'SLUG_TAKEN',
  // Conflict (409)
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  CONFLICT = 'CONFLICT', // #150 optimistic-lock stale write
  // Phase 7 Import — 409 conflicts
  ACTIVE_JOB_EXISTS = 'ACTIVE_JOB_EXISTS',
  BAD_COMMIT_TOKEN = 'BAD_COMMIT_TOKEN',
  IMPORT_JOB_NOT_COMMITTABLE = 'IMPORT_JOB_NOT_COMMITTABLE',
  // 400 — API.8: a dedupResolution decision does not match the row's
  // current dedup status (e.g. OVERWRITE on a non-duplicate STAGED row).
  INVALID_RESOLUTION = 'INVALID_RESOLUTION',
  STOCK_SHORTAGE = 'STOCK_SHORTAGE',
  EXPIRED_BATCH = 'EXPIRED_BATCH',
  ALL_BATCHES_EXPIRED = 'ALL_BATCHES_EXPIRED',
  INSUFFICIENT_BATCH_STOCK = 'INSUFFICIENT_BATCH_STOCK',
  BATCH_PRODUCT_MISMATCH = 'BATCH_PRODUCT_MISMATCH',

  // Rate Limit (429)
  RATE_LIMITED = 'RATE_LIMITED',

  // Server (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // Service Unavailable (503) — Phase 7 · 7.1B
  // M9: pg_enum precondition for OPENING_BALANCE (or any other schema
  // probe added later) not yet satisfied. The commit pipeline refuses
  // to run rather than write partial state.
  IMPORT_PRECONDITION_MISSING = 'IMPORT_PRECONDITION_MISSING',
  // Phase 7 · 7.1C — Invoice commit (PR-C3)
  // COMMIT_BLOCKED_PRODUCT_NOT_FOUND: pre-flight (post stale-re-resolve) saw
  // at least one line with an unresolved product. The chunk throws BEFORE
  // any Document INSERT — no partial state. Payload carries `blockedRowCount`
  // + `missingSkuSample` (≤5, DEBUG-logged only — S5).
  COMMIT_BLOCKED_PRODUCT_NOT_FOUND = 'COMMIT_BLOCKED_PRODUCT_NOT_FOUND',
  // PRODUCT_DELETED_DURING_COMMIT: TOCTOU — line resolved at preview but
  // the Product row was hard-deleted between preview and commit. Surfaced
  // by catching Prisma P2003 on `documentLineItem.createMany` (S8).
  PRODUCT_DELETED_DURING_COMMIT = 'PRODUCT_DELETED_DURING_COMMIT',
  // CONCURRENT_COMMIT_RACE: row-level guard `updateMany count=0` inside
  // commit-invoices; another commit pass already bound this row.
  CONCURRENT_COMMIT_RACE = 'CONCURRENT_COMMIT_RACE',
  COMMIT_BLOCKED_INVOICE_NOT_FOUND = 'COMMIT_BLOCKED_INVOICE_NOT_FOUND',
  OVER_ALLOCATION = 'OVER_ALLOCATION',
  ALLOCATION_INTERNAL_CONFLICT = 'ALLOCATION_INTERNAL_CONFLICT',
  PAYMENT_MODE_INVALID = 'PAYMENT_MODE_INVALID',
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: ErrorCode
    message: string
    details?: Record<string, unknown>
  }
}
