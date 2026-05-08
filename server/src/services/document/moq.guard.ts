/**
 * MOQ Guard — centralised minimum-order-quantity enforcement.
 *
 * Used by: create-batch-validation.ts (doc create), update.ts (doc update),
 * pos-checkout.pricing.ts (POS sale).
 *
 * Behaviour:
 *   enforceMoq=true  → throws AppError 400 BELOW_MOQ with all violations
 *   enforceMoq=false → returns warning objects (caller must attach to response)
 */

import { AppError, ErrorCode } from '../../lib/errors.js'

/** Document types where MOQ must be checked */
export const MOQ_ENFORCED_TYPES = new Set([
  'SALE_INVOICE',
  'ESTIMATE',
  'SALE_ORDER',
  'DELIVERY_CHALLAN',
  'PURCHASE_ORDER',
  'POS_SALE',
])

export interface MoqViolation {
  lineIndex: number
  productId: string
  productName: string
  moq: number
  qty: number
}

export interface MoqLineInput {
  productId: string
  quantity: number
}

export interface MoqProductRow {
  id: string
  name: string
  moq: number | null
}

/**
 * Assert MOQ for a batch of line items.
 *
 * @param docType     - document type string (e.g. 'SALE_INVOICE')
 * @param lines       - line items with productId + quantity
 * @param productMap  - map of productId → product row with moq
 * @param enforceMoq  - when false, collect violations as warnings instead of throwing
 * @returns           - array of warnings (empty if enforceMoq=true and no violations)
 * @throws            - AppError 400 BELOW_MOQ when enforceMoq=true and violations exist
 */
export function assertMoq(
  docType: string,
  lines: MoqLineInput[],
  productMap: Map<string, MoqProductRow>,
  enforceMoq: boolean
): MoqViolation[] {
  if (!MOQ_ENFORCED_TYPES.has(docType)) return []

  const violations: MoqViolation[] = []

  for (let i = 0; i < lines.length; i++) {
    const li = lines[i]
    const product = productMap.get(li.productId)
    if (!product) continue // already caught by product existence check upstream

    const moq = product.moq ?? 0
    if (moq <= 0) continue // no MOQ set — skip

    if (li.quantity < moq) {
      violations.push({
        lineIndex: i,
        productId: product.id,
        productName: product.name,
        moq,
        qty: li.quantity,
      })
    }
  }

  if (violations.length === 0) return []

  if (enforceMoq) {
    const first = violations[0]
    const msg =
      violations.length === 1
        ? `Qty ${first.qty} is below minimum order qty ${first.moq} for "${first.productName}"`
        : `${violations.length} line items are below their minimum order quantity`

    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, msg, {
      code: 'BELOW_MOQ',
      violations,
    })
  }

  // enforceMoq=false → caller appends warnings to response
  return violations
}
