/**
 * Internal helpers shared by product sub-modules.
 * Not exported from index — internal use only.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'

/** Verify product belongs to business, throw 404 if not */
export async function requireProduct(businessId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
  })
  if (!product) throw notFoundError('Product')
  return product
}

/** Generate next SKU for a business — atomic via UPDATE ... RETURNING to prevent races */
export async function generateSku(businessId: string): Promise<string> {
  // Ensure the row exists first (upsert with defaults), then atomically increment and fetch
  await prisma.inventorySetting.upsert({
    where: { businessId },
    create: { businessId },
    update: {},
  })

  const rows = await prisma.$queryRaw<Array<{ sku_prefix: string; sku_next_counter: number }>>`
    UPDATE "InventorySetting"
    SET "skuNextCounter" = "skuNextCounter" + 1, "updatedAt" = NOW()
    WHERE "businessId" = ${businessId}
    RETURNING "skuPrefix" as sku_prefix, "skuNextCounter" as sku_next_counter`

  // rows[0].sku_next_counter is the value AFTER increment; use counter - 1 as the claimed value
  const prefix = rows[0].sku_prefix ?? 'PRD'
  const counter = rows[0].sku_next_counter - 1
  return `${prefix}-${String(counter).padStart(4, '0')}`
}
