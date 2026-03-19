/**
 * Centralized Error Handling — adapted from HisaabPro
 * AppError class, error codes, factory functions, Prisma error normalization
 */

import logger from './logger.js'

export enum ErrorCode {
  // Validation (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  PHONE_INVALID = 'PHONE_INVALID',

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

  // Business Logic (422)
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  DOCUMENT_LOCKED = 'DOCUMENT_LOCKED',
  CONVERSION_NOT_ALLOWED = 'CONVERSION_NOT_ALLOWED',

  // Coupon (400)
  COUPON_NOT_FOUND = 'COUPON_NOT_FOUND',
  COUPON_EXPIRED = 'COUPON_EXPIRED',
  COUPON_EXHAUSTED = 'COUPON_EXHAUSTED',
  COUPON_ALREADY_USED = 'COUPON_ALREADY_USED',
  COUPON_INACTIVE = 'COUPON_INACTIVE',
  COUPON_NOT_STARTED = 'COUPON_NOT_STARTED',
  COUPON_PLAN_MISMATCH = 'COUPON_PLAN_MISMATCH',
  COUPON_MIN_AMOUNT = 'COUPON_MIN_AMOUNT',

  // Conflict (409)
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',

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
    const prismaError = error as { code: string; meta?: { target?: string[] } }
    if (prismaError.code === 'P2002') {
      const field = prismaError.meta?.target?.[0] || 'field'
      return conflictError(`${field} already exists`)
    }
    if (prismaError.code === 'P2025') {
      return notFoundError('Resource')
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
