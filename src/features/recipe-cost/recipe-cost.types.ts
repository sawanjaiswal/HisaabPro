/** Recipe Cost Dashboard — FE types. Mirrors server RecipeCostSummary. Money in PAISE. */

export interface RecipeComponentCost {
  componentProductId: string
  componentProductName: string
  quantity: number
  unitName: string | null
  unitCostPaise: number
  lineCostPaise: number
  costSharePct: number | null
  missingCost: boolean
}

export interface RecipeCost {
  bomId: string
  productId: string
  productName: string
  bomName: string
  salePricePaise: number
  recipeCostPaise: number
  marginPaise: number
  marginPct: number | null
  costliestComponentName: string | null
  incompleteCosting: boolean
  componentCount: number
  components: RecipeComponentCost[]
}

export interface RecipeCostSummary {
  recipes: RecipeCost[]
  incompleteCount: number
  lossMakingCount: number
}
