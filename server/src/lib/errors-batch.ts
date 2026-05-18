/**
 * Batch/stock-shortage error factories — split out of errors.ts (Phase 6 PR1A)
 *
 * Lives in its own file so errors.ts stays ≤250 lines per the file-layer
 * discipline in ~/.claude/CLAUDE.md. Consumers should keep importing from
 * `./errors.js` (re-exported there) so call sites don't need to change.
 */
import { AppError, ErrorCode } from './errors.js'

export interface StockShortageItem {
  productId: string
  productName: string
  requested: number
  available: number
}

/**
 * 409 STOCK_SHORTAGE — thrown when one or more sale invoice line items
 * cannot be fulfilled due to insufficient stock under HARD_BLOCK mode.
 * Collects ALL shortfalls so the caller sees every problem at once.
 */
export function stockShortageError(items: StockShortageItem[]) {
  return new AppError(
    ErrorCode.STOCK_SHORTAGE,
    409,
    `Insufficient stock for ${items.length} item(s)`,
    { items }
  )
}

/** 409 EXPIRED_BATCH — single client-supplied batch is expired and policy=HARD_BLOCK */
export function expiredBatchError(details: {
  batchId: string
  batchNumber: string
  expiryDate: Date
  productId: string
  productName: string
}) {
  return new AppError(
    ErrorCode.EXPIRED_BATCH,
    409,
    `Batch "${details.batchNumber}" expired on ${details.expiryDate.toISOString().split('T')[0]} and cannot be sold under the current policy`,
    details as unknown as Record<string, unknown>
  )
}

/** 409 ALL_BATCHES_EXPIRED — every available batch for product is expired (HARD_BLOCK) */
export function allBatchesExpiredError(details: {
  productId: string
  productName: string
  expiredBatchCount: number
}) {
  return new AppError(
    ErrorCode.ALL_BATCHES_EXPIRED,
    409,
    `All ${details.expiredBatchCount} available batch(es) for "${details.productName}" are expired and cannot be sold under the current policy`,
    details as unknown as Record<string, unknown>
  )
}

/** 400 BATCH_PRODUCT_MISMATCH — client-supplied batchId belongs to different product/business */
export function batchProductMismatchError(batchId: string, productId: string) {
  return new AppError(
    ErrorCode.BATCH_PRODUCT_MISMATCH,
    400,
    `Batch does not belong to the specified product`,
    { batchId, productId }
  )
}
