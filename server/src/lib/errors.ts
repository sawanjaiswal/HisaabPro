/** Centralized error handling — AppError + ErrorCode + Prisma normalization */
import logger from './logger.js'
import { ErrorCode, type ApiErrorResponse } from './errors.codes.js'

export { ErrorCode }
export type { ApiErrorResponse }


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

/**
 * "You are authenticated, but this business is not yours."
 *
 * The SSOT for that answer — `requireActiveBusiness` already returns exactly
 * this shape (middleware/require-active-business.ts). Returning 401 instead
 * tells the client the *session* is bad, which sends it through a pointless
 * token refresh and surfaces as "session expired" for what is really a
 * membership check.
 */
export function noMembershipError(message = 'You are not a member of this business') {
  return new AppError(ErrorCode.NO_MEMBERSHIP, 403, message)
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
