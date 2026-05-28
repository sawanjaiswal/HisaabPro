/**
 * Recipe Cost Dashboard — service. Loads active BOMs + component costs,
 * derives cost-per-unit / margin via pure math. Read-only, tenant-scoped.
 */

import { prisma } from '../../lib/prisma.js'
import { deriveRecipeCosts, type RawRecipe } from './recipe-cost.math.js'
import type { RecipeCostSummary } from './recipe-cost.types.js'
import type { RecipeCostQuery } from '../../schemas/recipe-cost.schemas.js'

export async function getRecipeCostSummary(
  businessId: string,
  query: RecipeCostQuery,
): Promise<RecipeCostSummary> {
  const boms = await prisma.bom.findMany({
    where: {
      businessId,
      isDeleted: false,
      isActive: true,
      ...(query.productId ? { productId: query.productId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      product: { select: { name: true, salePrice: true } },
      components: {
        include: {
          componentProduct: {
            select: { name: true, weightedAvgCostPaise: true, purchasePrice: true },
          },
          unit: { select: { name: true } },
        },
      },
    },
  })

  const raws: RawRecipe[] = boms.map((bom) => ({
    bomId: bom.id,
    productId: bom.productId,
    productName: bom.product.name,
    bomName: bom.name,
    salePricePaise: bom.product.salePrice,
    components: bom.components.map((c) => ({
      componentProductId: c.componentProductId,
      componentProductName: c.componentProduct.name,
      quantity: c.quantity,
      unitName: c.unit?.name ?? null,
      weightedAvgCostPaise: Number(c.componentProduct.weightedAvgCostPaise),
      purchasePricePaise: c.componentProduct.purchasePrice ?? null,
    })),
  }))

  return deriveRecipeCosts(raws)
}
