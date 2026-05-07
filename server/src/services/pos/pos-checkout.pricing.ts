/**
 * POS Checkout — Server-Authoritative Pricing Engine
 *
 * Loads products from DB and computes server-side line totals.
 * Client-sent prices are IGNORED — only DB prices are trusted.
 * All amounts in PAISE (integer).
 *
 * MUST be called within the outer Prisma $transaction (tx passed in).
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import type { PosItemInput, PricedLine } from './pos.types.js'
import { productNotFoundError, posValidationError } from './pos.errors.js'
import { MAX_DISCOUNT_BPS } from './pos.constants.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

interface TaxCategoryRow {
  id: string
  rate: number
  cessRate: number
  cessType: string
}

/**
 * Load products and tax categories, then compute fully-priced lines.
 *
 * @param tx         - Prisma tx client
 * @param businessId - Owning business
 * @param items      - Validated items from the checkout input
 * @returns          - Priced lines (no tax yet — that's pos-checkout.tax.ts)
 */
export async function priceLines(
  tx: TxClient,
  businessId: string,
  items: PosItemInput[]
): Promise<PricedLine[]> {
  const productIds = items.map(i => i.productId)

  // Fetch products in one query
  const products = await tx.product.findMany({
    where: { id: { in: productIds }, businessId, isDeleted: false, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      sku: true,
      hsnCode: true,
      salePrice: true,
      taxCategoryId: true,
      unit: { select: { symbol: true } },
    },
  })

  const productMap = new Map<string, typeof products[number]>(products.map(p => [p.id, p]))

  // Validate all products exist
  for (const item of items) {
    if (!productMap.has(item.productId)) {
      throw productNotFoundError(item.productId)
    }
  }

  // Collect taxCategoryIds for batch fetch
  const taxCategoryIds = [
    ...new Set(
      products.map(p => p.taxCategoryId).filter((id): id is string => id != null)
    ),
  ]

  const taxCategories: TaxCategoryRow[] =
    taxCategoryIds.length > 0
      ? await tx.taxCategory.findMany({
          where: { id: { in: taxCategoryIds }, businessId },
          select: { id: true, rate: true, cessRate: true, cessType: true },
        })
      : []

  const taxMap = new Map<string, TaxCategoryRow>(taxCategories.map(tc => [tc.id, tc]))

  return items.map((item, idx) => {
    const product = productMap.get(item.productId)!
    const ratePaise = product.salePrice  // server-authoritative

    // Resolve discount amount
    let discountAmount: number
    if (item.discountType === 'AMOUNT') {
      discountAmount = item.discountValue
    } else {
      // PERCENTAGE: discountValue is in basis points
      if (item.discountValue > MAX_DISCOUNT_BPS) {
        throw posValidationError(
          `Discount ${item.discountValue} bps exceeds 100% for product ${item.productId}`
        )
      }
      discountAmount = Math.floor(ratePaise * item.quantity * item.discountValue / MAX_DISCOUNT_BPS)
    }

    const grossLine = Math.round(ratePaise * item.quantity)
    if (discountAmount > grossLine) {
      throw posValidationError(
        `Discount (${discountAmount} paise) exceeds line total (${grossLine} paise) for product "${product.name}"`
      )
    }

    const lineTotal = grossLine - discountAmount

    const tc = product.taxCategoryId ? taxMap.get(product.taxCategoryId) : undefined

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      hsnCode: product.hsnCode,
      unitSymbol: product.unit.symbol,
      quantity: item.quantity,
      ratePaise,
      discountType: item.discountType,
      discountValue: item.discountValue,
      discountAmount,
      lineTotal,
      taxCategoryId: product.taxCategoryId,
      gstRate: tc?.rate ?? 0,
      cessRate: tc?.cessRate ?? 0,
      cessType: (tc?.cessType as 'PERCENTAGE' | 'FIXED_PER_UNIT') ?? 'PERCENTAGE',
      batchId: item.batchId,
      godownId: item.godownId,
      note: item.note,
      sortOrder: idx,
    } satisfies PricedLine
  })
}

/**
 * Sum subtotal (pre-discount gross) and total discount from priced lines.
 */
export function sumPricedLines(lines: PricedLine[]): {
  subtotal: number
  totalDiscount: number
  grandTotalPreTax: number
} {
  let subtotal = 0
  let totalDiscount = 0

  for (const l of lines) {
    subtotal += Math.round(l.ratePaise * l.quantity)
    totalDiscount += l.discountAmount
  }

  return { subtotal, totalDiscount, grandTotalPreTax: subtotal - totalDiscount }
}
