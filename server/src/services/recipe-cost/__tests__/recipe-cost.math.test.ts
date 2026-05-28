import { describe, it, expect } from 'vitest'
import {
  resolveUnitCostPaise,
  deriveRecipeCost,
  deriveRecipeCosts,
  type RawComponent,
  type RawRecipe,
} from '../recipe-cost.math.js'

function comp(over: Partial<RawComponent> = {}): RawComponent {
  return {
    componentProductId: 'c1',
    componentProductName: 'Flour',
    quantity: 2,
    unitName: 'kg',
    weightedAvgCostPaise: 5000,
    purchasePricePaise: 4000,
    ...over,
  }
}

function recipe(over: Partial<RawRecipe> = {}): RawRecipe {
  return {
    bomId: 'b1',
    productId: 'p1',
    productName: 'Cake',
    bomName: 'Default',
    salePricePaise: 30000,
    components: [comp()],
    ...over,
  }
}

describe('resolveUnitCostPaise', () => {
  it('prefers weightedAvg when > 0', () => {
    expect(resolveUnitCostPaise(comp({ weightedAvgCostPaise: 5000, purchasePricePaise: 4000 }))).toBe(5000)
  })
  it('falls back to purchasePrice when weightedAvg is 0', () => {
    expect(resolveUnitCostPaise(comp({ weightedAvgCostPaise: 0, purchasePricePaise: 4000 }))).toBe(4000)
  })
  it('is 0 when both are absent', () => {
    expect(resolveUnitCostPaise(comp({ weightedAvgCostPaise: 0, purchasePricePaise: null }))).toBe(0)
  })
})

describe('deriveRecipeCost', () => {
  it('sums component line costs (quantity × unitCost)', () => {
    const r = deriveRecipeCost(recipe({ components: [comp({ quantity: 2, weightedAvgCostPaise: 5000 })] }))
    expect(r.recipeCostPaise).toBe(10000)
    expect(r.components[0].lineCostPaise).toBe(10000)
  })

  it('computes margin and margin pct', () => {
    const r = deriveRecipeCost(recipe({ salePricePaise: 30000, components: [comp({ quantity: 2, weightedAvgCostPaise: 5000 })] }))
    expect(r.marginPaise).toBe(20000)
    expect(r.marginPct).toBeCloseTo(66.667, 2)
  })

  it('returns null marginPct when salePrice is 0', () => {
    const r = deriveRecipeCost(recipe({ salePricePaise: 0 }))
    expect(r.marginPct).toBeNull()
  })

  it('returns negative margin for loss-making recipe', () => {
    const r = deriveRecipeCost(recipe({ salePricePaise: 5000, components: [comp({ quantity: 2, weightedAvgCostPaise: 5000 })] }))
    expect(r.marginPaise).toBe(-5000)
  })

  it('flags incompleteCosting when a component has no cost', () => {
    const r = deriveRecipeCost(recipe({
      components: [comp({ weightedAvgCostPaise: 5000 }), comp({ componentProductId: 'c2', weightedAvgCostPaise: 0, purchasePricePaise: null })],
    }))
    expect(r.incompleteCosting).toBe(true)
    expect(r.components[1].missingCost).toBe(true)
  })

  it('identifies the costliest component', () => {
    const r = deriveRecipeCost(recipe({
      components: [
        comp({ componentProductId: 'cheap', componentProductName: 'Sugar', quantity: 1, weightedAvgCostPaise: 1000 }),
        comp({ componentProductId: 'pricey', componentProductName: 'Butter', quantity: 3, weightedAvgCostPaise: 8000 }),
      ],
    }))
    expect(r.costliestComponentName).toBe('Butter')
  })

  it('computes per-component cost share that sums to ~100', () => {
    const r = deriveRecipeCost(recipe({
      components: [
        comp({ componentProductId: 'a', quantity: 1, weightedAvgCostPaise: 4000 }),
        comp({ componentProductId: 'b', quantity: 1, weightedAvgCostPaise: 6000 }),
      ],
    }))
    const total = (r.components[0].costSharePct ?? 0) + (r.components[1].costSharePct ?? 0)
    expect(total).toBeCloseTo(100, 5)
  })

  it('null cost share when recipe cost is 0', () => {
    const r = deriveRecipeCost(recipe({ components: [comp({ weightedAvgCostPaise: 0, purchasePricePaise: null })] }))
    expect(r.components[0].costSharePct).toBeNull()
  })

  it('rounds fractional line cost to integer paise', () => {
    const r = deriveRecipeCost(recipe({ components: [comp({ quantity: 1.5, weightedAvgCostPaise: 333 })] }))
    expect(Number.isInteger(r.recipeCostPaise)).toBe(true)
    expect(r.recipeCostPaise).toBe(500) // round(499.5)
  })
})

describe('deriveRecipeCosts', () => {
  it('aggregates incomplete and loss-making counts', () => {
    const out = deriveRecipeCosts([
      recipe({ bomId: 'ok', salePricePaise: 30000 }),
      recipe({ bomId: 'loss', salePricePaise: 5000, components: [comp({ quantity: 2, weightedAvgCostPaise: 5000 })] }),
      recipe({ bomId: 'incomplete', components: [comp({ weightedAvgCostPaise: 0, purchasePricePaise: null })] }),
    ])
    expect(out.recipes).toHaveLength(3)
    expect(out.lossMakingCount).toBe(1)
    expect(out.incompleteCount).toBe(1)
  })
})
