/**
 * Document Service — update totals/lineItems recompute helper.
 *
 * Extracted from update.ts to keep that file under the 250L cap. This module
 * owns the pure prep work when `data.lineItems` is supplied on update:
 *   1. Validate every productId belongs to this business
 *   2. Run MOQ guard (honours DocumentSettings.enforceMoq)
 *   3. Resolve tax category map + business GST context
 *   4. Build calcItems (BOGO free items contribute 0)
 *   5. Recompute totals via calculateDocumentTotals
 *   6. Delete + recreate line items and additional-charge rows
 *
 * Caller: update.ts inside the document `$transaction`. Returns
 * `{ totals, moqWarnings }`. `productMap` is internal — caller doesn't need it.
 */
import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import { calculateDocumentTotals, calculateChargeAmount } from '../document-calc.js'
import { assertCompositionNoLineTax, assertCompositionNoInterState } from './create-tax-prep.js'
import { assertMoq, type MoqViolation } from './moq.guard.js'
import { buildLineItemData } from './line-item-builder.js'
import { getRoundOffSetting } from './helpers.js'
import type { UpdateDocumentInput } from '../../schemas/document.schemas.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

interface ExistingDoc {
  type: string
  placeOfSupply: string | null
  isComposite: boolean | null
}

export interface RecomputeResult {
  totals: ReturnType<typeof calculateDocumentTotals>
  moqWarnings: MoqViolation[]
}

export async function recomputeLineItemsAndTotals(
  tx: TxClient,
  businessId: string,
  documentId: string,
  existing: ExistingDoc,
  data: UpdateDocumentInput
): Promise<RecomputeResult> {
  if (!data.lineItems) throw new Error('recomputeLineItemsAndTotals requires data.lineItems')
  const productIds = data.lineItems.map(li => li.productId)
  const products = await tx.product.findMany({
    where: { id: { in: productIds }, businessId },
    select: { id: true, name: true, purchasePrice: true, currentStock: true, moq: true },
  })
  const productMap = new Map(products.map(p => [p.id, p]))
  for (const li of data.lineItems) {
    if (!productMap.has(li.productId)) throw notFoundError(`Product ${li.productId}`)
  }

  const _s = await tx.documentSettings.findUnique({ where: { businessId }, select: { enforceMoq: true } })
  const moqWarnings = assertMoq(
    existing.type,
    data.lineItems.map(li => ({ productId: li.productId, quantity: li.quantity })),
    productMap,
    _s?.enforceMoq ?? true,
  )

  const taxCategoryIds = data.lineItems
    .map(li => li.taxCategoryId)
    .filter((id): id is string => !!id)
  const taxCategories = taxCategoryIds.length > 0
    ? await tx.taxCategory.findMany({
        where: { id: { in: taxCategoryIds }, businessId },
        select: { id: true, cessRate: true, cessType: true },
      })
    : []
  const taxCategoryMap = new Map(taxCategories.map(tc => [tc.id, tc]))
  const biz = await tx.business.findUnique({
    where: { id: businessId },
    select: { stateCode: true, compositionScheme: true },
  })

  const roundOffSetting = await getRoundOffSetting(businessId)
  const placeOfSupply = data.placeOfSupply ?? existing.placeOfSupply ?? null
  const isCompositeUpdate = data.isComposite ?? existing.isComposite ?? biz?.compositionScheme ?? false

  assertCompositionNoLineTax(isCompositeUpdate, data.lineItems)
  assertCompositionNoInterState(isCompositeUpdate, biz?.stateCode ?? null, placeOfSupply)

  const calcItems = data.lineItems.map(li => {
    const tc = li.taxCategoryId ? taxCategoryMap.get(li.taxCategoryId) : undefined
    // #133 BOGO — free items contribute 0 to revenue / discount / tax
    if (li.isFreeItem) {
      return {
        quantity: li.quantity, rate: 0,
        discountType: li.discountType, discountValue: 0,
        purchasePrice: productMap.get(li.productId)!.purchasePrice || 0,
        gstRate: 0, cessRate: 0, cessType: tc?.cessType ?? 'PERCENTAGE',
      }
    }
    return {
      quantity: li.quantity, rate: li.rate,
      discountType: li.discountType, discountValue: li.discountValue,
      purchasePrice: productMap.get(li.productId)!.purchasePrice || 0,
      gstRate: li.gstRate,
      cessRate: tc?.cessRate ?? 0,
      cessType: tc?.cessType ?? 'PERCENTAGE',
    }
  })
  const calcCharges = (data.additionalCharges || []).map(c => ({ type: c.type, value: c.value }))
  const totals = calculateDocumentTotals(calcItems, calcCharges, roundOffSetting, {
    businessStateCode: biz?.stateCode ?? null,
    placeOfSupply: placeOfSupply as string | null,
    isComposite: isCompositeUpdate,
  })

  await tx.documentLineItem.deleteMany({ where: { documentId } })
  const lineItemData = buildLineItemData(documentId, data.lineItems, productMap, totals)
  await tx.documentLineItem.createMany({ data: lineItemData })

  if (data.additionalCharges) {
    await tx.documentAdditionalCharge.deleteMany({ where: { documentId } })
    if (data.additionalCharges.length > 0) {
      const chargeData = data.additionalCharges.map((c, i) => ({
        documentId, name: c.name, type: c.type, value: c.value,
        amount: calculateChargeAmount(totals.subtotal, c.type, c.value),
        sortOrder: i,
      }))
      await tx.documentAdditionalCharge.createMany({ data: chargeData })
    }
  }

  return { totals, moqWarnings }
}
