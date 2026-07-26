/**
 * Document Service — shared line-item persistence builder.
 * Extracted from create.ts and update.ts to keep both ≤250 LOC.
 */
import type { DocumentTotalsResult } from '../document-calc.types.js'

interface LineItemInput {
  productId: string
  quantity: number
  rate: number
  discountType: string
  discountValue: number
  taxCategoryId?: string | null
  hsnCode?: string | null
  sacCode?: string | null
  isFreeItem?: boolean
}

interface ProductSlice {
  purchasePrice: number | null
  currentStock: number
}

export function buildLineItemData(
  documentId: string,
  lineItems: LineItemInput[],
  productMap: Map<string, ProductSlice>,
  totals: DocumentTotalsResult,
) {
  return lineItems.map((li, i) => {
    const product = productMap.get(li.productId)!
    const calc = totals.lineResults[i]
    return {
      documentId,
      productId: li.productId,
      sortOrder: i,
      quantity: li.quantity,
      rate: li.rate,
      discountType: li.discountType,
      discountValue: li.discountValue,
      discountAmount: calc.discountAmount,
      lineTotal: calc.lineTotal,
      purchasePrice: product.purchasePrice || 0,
      profit: calc.profit,
      profitPercent: calc.profitPercent,
      stockBefore: product.currentStock,
      stockAfter: product.currentStock,
      taxCategoryId: li.taxCategoryId ?? null,
      hsnCode: li.hsnCode ?? null,
      sacCode: li.sacCode ?? null,
      taxableValue: calc.taxableValue ?? 0,
      cgstRate: calc.cgstRate ?? 0,
      cgstAmount: calc.cgstAmount ?? 0,
      sgstRate: calc.sgstRate ?? 0,
      sgstAmount: calc.sgstAmount ?? 0,
      igstRate: calc.igstRate ?? 0,
      igstAmount: calc.igstAmount ?? 0,
      cessRate: calc.cessRate ?? 0,
      cessAmount: calc.cessAmount ?? 0,
      isFreeItem: li.isFreeItem ?? false,
    }
  })
}
