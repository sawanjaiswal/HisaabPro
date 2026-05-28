/**
 * Recipe Cost Dashboard — pure cost-derivation math.
 * No I/O, no Prisma. All money in PAISE (integer). Caller converts BigInt → Number first.
 */

import type { RecipeComponentCost, RecipeCost } from './recipe-cost.types.js'

export interface RawComponent {
  componentProductId: string
  componentProductName: string
  quantity: number
  unitName: string | null
  /** Product.weightedAvgCostPaise already Number()-converted. */
  weightedAvgCostPaise: number
  /** Product.purchasePrice (paise), fallback when weightedAvg is 0. */
  purchasePricePaise: number | null
}

export interface RawRecipe {
  bomId: string
  productId: string
  productName: string
  bomName: string
  salePricePaise: number
  components: RawComponent[]
}

/** weightedAvg if > 0, else purchasePrice, else 0. */
export function resolveUnitCostPaise(c: RawComponent): number {
  if (c.weightedAvgCostPaise > 0) return c.weightedAvgCostPaise
  return c.purchasePricePaise ?? 0
}

export function deriveRecipeCost(raw: RawRecipe): RecipeCost {
  const lines = raw.components.map((c) => {
    const unitCostPaise = resolveUnitCostPaise(c)
    return {
      componentProductId: c.componentProductId,
      componentProductName: c.componentProductName,
      quantity: c.quantity,
      unitName: c.unitName,
      unitCostPaise,
      lineCostPaise: Math.round(c.quantity * unitCostPaise),
      missingCost: unitCostPaise === 0,
    }
  })

  const recipeCostPaise = lines.reduce((sum, l) => sum + l.lineCostPaise, 0)

  const components: RecipeComponentCost[] = lines.map((l) => ({
    ...l,
    costSharePct: recipeCostPaise > 0 ? (l.lineCostPaise / recipeCostPaise) * 100 : null,
  }))

  const costliest = lines.reduce<typeof lines[number] | null>(
    (max, l) => (max === null || l.lineCostPaise > max.lineCostPaise ? l : max),
    null,
  )

  const marginPaise = raw.salePricePaise - recipeCostPaise

  return {
    bomId: raw.bomId,
    productId: raw.productId,
    productName: raw.productName,
    bomName: raw.bomName,
    salePricePaise: raw.salePricePaise,
    recipeCostPaise,
    marginPaise,
    marginPct: raw.salePricePaise > 0 ? (marginPaise / raw.salePricePaise) * 100 : null,
    costliestComponentName: costliest?.componentProductName ?? null,
    incompleteCosting: lines.some((l) => l.missingCost),
    componentCount: lines.length,
    components,
  }
}

export function deriveRecipeCosts(raws: RawRecipe[]): {
  recipes: RecipeCost[]
  incompleteCount: number
  lossMakingCount: number
} {
  const recipes = raws.map(deriveRecipeCost)
  return {
    recipes,
    incompleteCount: recipes.filter((r) => r.incompleteCosting).length,
    lossMakingCount: recipes.filter((r) => r.marginPaise < 0).length,
  }
}
