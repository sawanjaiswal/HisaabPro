/** Centralized error handling — AppError + ErrorCode + Prisma normalization */
import logger from './logger.js'

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
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: ErrorCode
    message: string
    details?: Record<string, unknown>
  }
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }

  toResponse(): ApiErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    }
  }
}

// Factory functions
export function validationError(message: string, details?: Record<string, unknown>) {
  return new AppError(ErrorCode.VALIDATION_ERROR, 400, message, details)
}

export function notFoundError(resource: string, details?: Record<string, unknown>) {
  return new AppError(ErrorCode.NOT_FOUND, 404, `${resource} not found`, details)
}

export function unauthorizedError(message = 'Unauthorized access', code = ErrorCode.UNAUTHORIZED) {
  return new AppError(code, 401, message)
}

export function insufficientStockError(
  productName: string,
  currentStock: number,
  requestedQty: number,
  deficit: number
) {
  return new AppError(ErrorCode.INSUFFICIENT_STOCK, 422, `Insufficient stock for "${productName}"`, {
    currentStock,
    requestedQty,
    deficit,
  })
}

export function conflictError(message: string) {
  return new AppError(ErrorCode.DUPLICATE_ENTRY, 409, message)
}

// Batch/stock-shortage factories moved to ./errors-batch.ts (Phase 6 PR1A
// file-layer discipline: errors.ts must stay ≤250 lines). Re-exported below
// so existing `import { stockShortageError } from '../../lib/errors.js'`
// call sites keep working.
export type { StockShortageItem } from './errors-batch.js'
export {
  stockShortageError,
  expiredBatchError,
  allBatchesExpiredError,
  batchProductMismatchError,
} from './errors-batch.js'

export function rateLimitError(message = 'Too many requests', retryAfter?: number) {
  return new AppError(ErrorCode.RATE_LIMITED, 429, message, retryAfter ? { retryAfter } : undefined)
}

export function internalError(message = 'Internal server error', details?: Record<string, unknown>) {
  return new AppError(ErrorCode.INTERNAL_ERROR, 500, message, details)
}

/** Normalize any error into AppError — handles Prisma errors */
export function handleError(error: unknown): AppError {
  if (error instanceof AppError) return error

  // Prisma errors
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const prismaError = error as { code: string; meta?: { target?: string[]; cause?: string } }
    switch (prismaError.code) {
      case 'P2002': {
        const field = prismaError.meta?.target?.[0] || 'field'
        return conflictError(`${field} already exists`)
      }
      case 'P2025':
        return notFoundError('Resource')
      case 'P2003':
        return new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Related record not found (foreign key constraint)', {
          cause: prismaError.meta?.cause,
        })
      case 'P2014':
        return new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Required relation violation')
      case 'P2024':
        return new AppError(ErrorCode.DATABASE_ERROR, 503, 'Database connection timeout — please retry')
      default:
        if (prismaError.code.startsWith('P')) {
          logger.error('Unhandled Prisma error', { code: prismaError.code, meta: prismaError.meta })
          return new AppError(ErrorCode.DATABASE_ERROR, 500, 'A database error occurred')
        }
    }
  }

  // Zod validation errors
  if (error instanceof Error && error.name === 'ZodError' && 'issues' in error) {
    const issues = (error as { issues: Array<{ path: (string | number)[]; message: string }> }).issues
    const message = issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
    return validationError(message)
  }

  if (error instanceof Error) {
    logger.error('Unhandled error:', error)
    const safeMessage = process.env.NODE_ENV === 'production'
      ? 'An internal error occurred'
      : error.message
    return internalError(safeMessage)
  }

  logger.error('Unknown error:', error)
  return internalError('An unexpected error occurred')
}
