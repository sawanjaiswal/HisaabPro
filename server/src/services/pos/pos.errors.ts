/**
 * POS Checkout — Typed AppError Factories
 * All POS-specific error codes and structured factory functions.
 */

import { AppError, ErrorCode } from '../../lib/errors.js'

// ─── POS-specific error code strings (not in the shared enum) ─────────────
// We extend via string union so we don't modify the shared enum.
export const POS_ERROR_CODES = {
  EMPTY_CART: 'EMPTY_CART',
  OVERSELL_BLOCKED: 'OVERSELL_BLOCKED',
  EXPIRED_BATCH_BLOCKED: 'EXPIRED_BATCH_BLOCKED',
  TOTAL_MISMATCH: 'TOTAL_MISMATCH',
  PAYMENT_SUM_MISMATCH: 'PAYMENT_SUM_MISMATCH',
  DUPLICATE_CLIENT_ID: 'DUPLICATE_CLIENT_ID',
  INVALID_IDEMPOTENCY_KEY: 'INVALID_IDEMPOTENCY_KEY',
} as const

export type PosErrorCode = (typeof POS_ERROR_CODES)[keyof typeof POS_ERROR_CODES]

// ─── Shared-enum factories ─────────────────────────────────────────────────

/** 400 — Zod schema violation or semantic validation failure. */
export function posValidationError(message: string, details?: Record<string, unknown>) {
  return new AppError(ErrorCode.VALIDATION_ERROR, 400, message, details)
}

/** 404 — One or more products in the cart do not exist for this business. */
export function productNotFoundError(productId: string) {
  return new AppError(
    ErrorCode.PRODUCT_NOT_FOUND,
    404,
    `Product not found: ${productId}`,
    { productId }
  )
}

// ─── POS-specific factories (extend AppError with custom code strings) ─────

/** 422 — Cart contains zero line items. */
export function emptyCartError() {
  return new AppError(
    ErrorCode.VALIDATION_ERROR,
    422,
    'Cart must contain at least one item',
    { posCode: POS_ERROR_CODES.EMPTY_CART }
  )
}

/** 400 — Product is out of stock and oversell policy is HARD_BLOCK. */
export function oversellBlockedError(productId: string, productName: string, deficit: number) {
  return new AppError(
    ErrorCode.INSUFFICIENT_STOCK,
    400,
    `Insufficient stock for "${productName}" (deficit: ${deficit})`,
    { posCode: POS_ERROR_CODES.OVERSELL_BLOCKED, productId, deficit }
  )
}

/** 400 — Requested batch is expired and expiry policy is HARD_BLOCK. */
export function expiredBatchBlockedError(batchId: string, batchNumber: string, expiryDate: Date) {
  return new AppError(
    ErrorCode.EXPIRED_BATCH,
    400,
    `Batch "${batchNumber}" expired on ${expiryDate.toISOString().split('T')[0]} and cannot be sold`,
    { posCode: POS_ERROR_CODES.EXPIRED_BATCH_BLOCKED, batchId, batchNumber, expiryDate }
  )
}

/** 400 — Server-calculated grand total diverges from client value beyond tolerance. */
export function totalMismatchError(serverTotal: number, clientTotal: number, drift: number) {
  return new AppError(
    ErrorCode.VALIDATION_ERROR,
    400,
    `Grand total mismatch: server=${serverTotal}, client=${clientTotal}, drift=${drift} paise`,
    { posCode: POS_ERROR_CODES.TOTAL_MISMATCH, serverTotal, clientTotal, drift }
  )
}

/** 400 — Sum of payment breakdown does not equal grand total. */
export function paymentSumMismatchError(paymentSum: number, grandTotal: number) {
  return new AppError(
    ErrorCode.VALIDATION_ERROR,
    400,
    `Payment sum (${paymentSum}) must equal grand total (${grandTotal})`,
    { posCode: POS_ERROR_CODES.PAYMENT_SUM_MISMATCH, paymentSum, grandTotal }
  )
}

/** 409 — clientId already used for a different completed sale in this business. */
export function duplicateClientIdError(clientId: string) {
  return new AppError(
    ErrorCode.DUPLICATE_ENTRY,
    409,
    `Duplicate clientId: a sale with id "${clientId}" already exists`,
    { posCode: POS_ERROR_CODES.DUPLICATE_CLIENT_ID, clientId }
  )
}

/** 400 — idempotencyKey is not a valid v4 UUID. */
export function invalidIdempotencyKeyError(key: string) {
  return new AppError(
    ErrorCode.VALIDATION_ERROR,
    400,
    `idempotencyKey must be a valid UUID v4, received: "${key}"`,
    { posCode: POS_ERROR_CODES.INVALID_IDEMPOTENCY_KEY, key }
  )
}
