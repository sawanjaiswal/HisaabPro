/** Batch / line-item validation helpers for createDocument */
import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import type { CreateDocumentInput } from '../../schemas/document.schemas.js'

export type ProductRow = {
  id: string
  name: string
  purchasePrice: number | null
  currentStock: number
  moq: number | null
}

/**
 * Fetches all products referenced by the line items, validates they exist
 * and (for PURCHASE_ORDER) that each quantity meets the product's MOQ.
 *
 * Returns the product array and a Map keyed by product id.
 */
export async function validateLineItemProducts(
  businessId: string,
  data: Pick<CreateDocumentInput, 'type' | 'lineItems'>,
): Promise<{ products: ProductRow[]; productMap: Map<string, ProductRow> }> {
  const productIds = data.lineItems.map(li => li.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, businessId },
    select: { id: true, name: true, purchasePrice: true, currentStock: true, moq: true },
  })
  const productMap = new Map(products.map(p => [p.id, p]))

  for (const li of data.lineItems) {
    if (!productMap.has(li.productId)) throw notFoundError(`Product ${li.productId}`)
  }

  if (data.type === 'PURCHASE_ORDER') {
    for (const li of data.lineItems) {
      const product = productMap.get(li.productId)!
      if (product.moq !== null && product.moq !== undefined && li.quantity < product.moq) {
        throw validationError(
          `Quantity for "${product.name}" is below minimum order quantity of ${product.moq}`
        )
      }
    }
  }

  return { products, productMap }
}
