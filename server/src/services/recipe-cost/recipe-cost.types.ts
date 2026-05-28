/**
 * Recipe Cost Dashboard — types.
 * Read-only derivation over existing BOM data (#115). All money in PAISE.
 */

export interface RecipeComponentCost {
  componentProductId: string
  componentProductName: string
  quantity: number
  unitName: string | null
  /** Per-unit cost used in the calc (weightedAvg, else purchasePrice, else 0). */
  unitCostPaise: number
  /** quantity × unitCostPaise. */
  lineCostPaise: number
  /** This component's share of the total recipe cost (0-100), null when recipe cost is 0. */
  costSharePct: number | null
  /** unitCostPaise resolved to 0 — cost data missing for this component. */
  missingCost: boolean
}

export interface RecipeCost {
  bomId: string
  productId: string
  productName: string
  bomName: string
  /** Finished-good sale price in paise. */
  salePricePaise: number
  /** Σ component lineCostPaise. */
  recipeCostPaise: number
  /** salePricePaise − recipeCostPaise (may be negative). */
  marginPaise: number
  /** marginPaise / salePricePaise × 100, null when salePrice is 0. */
  marginPct: number | null
  /** Name of the highest-contribution component, null when no components. */
  costliestComponentName: string | null
  /** Any component had unitCostPaise === 0 — recipe cost is understated. */
  incompleteCosting: boolean
  componentCount: number
  components: RecipeComponentCost[]
}

export interface RecipeCostSummary {
  recipes: RecipeCost[]
  /** Count of recipes flagged incompleteCosting. */
  incompleteCount: number
  /** Count of recipes selling below derived cost (marginPaise < 0). */
  lossMakingCount: number
}
