/**
 * Stock Value Report Service — INV-04
 *
 * Returns per-product weighted-average cost × currentStock totals,
 * ordered by line value descending. Cursor-paginated.
 * All monetary values in paise (BigInt).
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

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
  items: StockValueItem[]
  nextCursor: string | null
}

interface Opts {
  cursor?: string
  limit?: number
  categoryId?: string
}

/**
 * Compute stock value report for a business.
 * Formula: lineValue = currentStock × weightedAvgCostPaise (integer math, no floats for money).
 */
export async function getStockValueReport(
  businessId: string,
  opts: Opts = {}
): Promise<StockValueReport> {
  const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT)
  const asOf = new Date()

  // Decode cursor: base64("lineValue:id")
  let cursorLineValue: bigint | null = null
  let cursorId: string | null = null
  if (opts.cursor) {
    try {
      const decoded = Buffer.from(opts.cursor, 'base64url').toString('utf8')
      const [lv, id] = decoded.split(':')
      cursorLineValue = BigInt(lv)
      cursorId = id
    } catch {
      logger.warn('Invalid stock-value cursor ignored', { cursor: opts.cursor })
    }
  }

  const categoryFilter = opts.categoryId ? { categoryId: opts.categoryId } : {}

  // Fetch one extra row to determine hasMore
  const rows = await prisma.product.findMany({
    where: {
      businessId,
      isDeleted: false,
      ...categoryFilter,
    },
    select: {
      id: true,
      name: true,
      sku: true,
      currentStock: true,
      weightedAvgCostPaise: true,
    },
    orderBy: [
      // Prisma cannot order by computed fields — we do post-sort after fetching
      // To keep this efficient we fetch all non-deleted products for the business
      // and apply cursor-based slicing after computing line values.
      // For businesses with >10k products a raw SQL aggregate would be preferable;
      // for MVP scale this is acceptable (same page reload path as stock-summary).
      { currentStock: 'desc' },
      { id: 'asc' },
    ],
  })

  // Compute line values and sort by lineValue DESC, id ASC
  type Row = {
    productId: string
    productName: string
    sku: string | null
    currentStock: number
    weightedAvgCostPaise: bigint
    lineValuePaise: bigint
  }
  const computed: Row[] = rows.map((r) => ({
    productId: r.id,
    productName: r.name,
    sku: r.sku,
    currentStock: Number(r.currentStock),
    weightedAvgCostPaise: r.weightedAvgCostPaise,
    lineValuePaise: BigInt(Math.round(Number(r.currentStock))) * r.weightedAvgCostPaise,
  }))

  computed.sort((a, b) => {
    if (b.lineValuePaise > a.lineValuePaise) return 1
    if (b.lineValuePaise < a.lineValuePaise) return -1
    return a.productId < b.productId ? -1 : 1
  })

  // Summary (full set — before cursor slicing)
  const totalValuePaise = computed.reduce((sum, r) => sum + r.lineValuePaise, BigInt(0))
  const productCount = computed.length

  // Apply cursor
  let sliced = computed
  if (cursorLineValue !== null && cursorId !== null) {
    const idx = computed.findIndex(
      (r) => r.lineValuePaise === cursorLineValue && r.productId === cursorId
    )
    sliced = idx >= 0 ? computed.slice(idx + 1) : computed
  }

  const page = sliced.slice(0, limit + 1)
  const hasMore = page.length > limit
  if (hasMore) page.pop()

  let nextCursor: string | null = null
  if (hasMore && page.length > 0) {
    const last = page[page.length - 1]
    nextCursor = Buffer.from(`${last.lineValuePaise}:${last.productId}`).toString('base64url')
  }

  return {
    totalValuePaise,
    productCount,
    asOf,
    items: page,
    nextCursor,
  }
}
