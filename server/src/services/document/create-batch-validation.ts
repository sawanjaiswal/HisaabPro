/** Batch / line-item validation helpers for createDocument */
import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import type { CreateDocumentInput } from '../../schemas/document.schemas.js'
import { assertMoq, type MoqViolation } from './moq.guard.js'

export type ProductRow = {
  id: string
  name: string
  purchasePrice: number | null
  currentStock: number
  moq: number | null
}

/**
 * Fetches all products referenced by the line items, validates they exist,
 * and enforces MOQ for applicable document types (SALE_INVOICE, ESTIMATE,
 * SALE_ORDER, DELIVERY_CHALLAN, PURCHASE_ORDER, POS_SALE).
 *
 * When DocumentSettings.enforceMoq=true → throws 400 BELOW_MOQ on violations.
 * When DocumentSettings.enforceMoq=false → returns violations as warnings.
 *
 * Returns the product array, productMap, and any MOQ warnings.
 */
export async function validateLineItemProducts(
  businessId: string,
  data: Pick<CreateDocumentInput, 'type' | 'lineItems'>,
): Promise<{ products: ProductRow[]; productMap: Map<string, ProductRow>; moqWarnings: MoqViolation[] }> {
  const productIds = data.lineItems.map(li => li.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, businessId },
    select: { id: true, name: true, purchasePrice: true, currentStock: true, moq: true },
  })
  const productMap = new Map(products.map(p => [p.id, p]))

  for (const li of data.lineItems) {
    if (!productMap.has(li.productId)) throw notFoundError(`Product ${li.productId}`)
  }

  // Resolve enforceMoq setting (default true if settings row absent)
  const settings = await prisma.documentSettings.findUnique({
    where: { businessId },
    select: { enforceMoq: true },
  })
  const enforceMoq = settings?.enforceMoq ?? true

  const moqWarnings = assertMoq(
    data.type,
    data.lineItems.map(li => ({ productId: li.productId, quantity: li.quantity })),
    productMap,
    enforceMoq,
  )

  return { products, productMap, moqWarnings }
}
