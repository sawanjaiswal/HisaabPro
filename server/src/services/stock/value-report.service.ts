/**
 * Stock Value Report Service — INV-04 + BAT-06
 *
 * BAT-06: products with any Batch records emit one row PER BATCH (currentStock > 0).
 * Non-batch products keep the single-row-per-product path using weightedAvgCostPaise.
 *
 * Cursor format: base64url("{totalPaise}:{productId}:{batchId|''}")
 * All monetary values in paise (BigInt). No Number() wrapping of money.
 */

import logger from '../../lib/logger.js'
import {
  runValueQuery,
  runValueSummary,
  encodeCursor,
  decodeCursor,
} from './value-report-queries.js'
import type { ValueRow } from './value-report-queries.js'

export type { ValueRow, BatchValueRow, ProductValueRow } from './value-report-queries.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

// Legacy shape kept for the route handler (backward-compatible)
export interface StockValueItem {
  productId: string
  productName: string
  sku: string | null
  currentStock: number
  weightedAvgCostPaise: bigint
  lineValuePaise: bigint
}

export interface StockValueReport {
  totalValuePaise: bigint
  productCount: number
  asOf: Date
  items: ValueRow[]
  nextCursor: string | null
}

interface Opts {
  cursor?: string
  limit?: number
  categoryId?: string
}

/**
 * Compute per-batch (and per-product fallback) stock value report.
 */
export async function getStockValueReport(
  businessId: string,
  opts: Opts = {}
): Promise<StockValueReport> {
  const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT)
  const asOf = new Date()

  // Decode cursor
  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null
  if (opts.cursor && !cursor) {
    logger.warn('Invalid stock-value cursor ignored', { cursor: opts.cursor })
  }

  // Parallel: page rows + summary
  const [rows, summary] = await Promise.all([
    runValueQuery({ businessId, cursor, limit, categoryId: opts.categoryId }),
    runValueSummary(businessId, opts.categoryId),
  ])

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  let nextCursor: string | null = null
  if (hasMore && page.length > 0) {
    nextCursor = encodeCursor(page[page.length - 1])
  }

  return {
    totalValuePaise: summary.totalPaise,
    productCount: summary.rowCount,
    asOf,
    items: page,
    nextCursor,
  }
}
