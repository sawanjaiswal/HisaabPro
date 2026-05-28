/** Recipe Cost Dashboard — pure display helpers. */

import type { RecipeCost } from './recipe-cost.types'

export type MarginTone = 'good' | 'thin' | 'loss' | 'unknown'

/** Margin health bucket for badge colour. Thin = positive but < 20%. */
export function marginTone(recipe: RecipeCost): MarginTone {
  if (recipe.marginPct === null) return 'unknown'
  if (recipe.marginPaise < 0) return 'loss'
  if (recipe.marginPct < 20) return 'thin'
  return 'good'
}

/** Formats a margin percent for display, or an em-dash when unknown. */
export function formatMarginPct(pct: number | null): string {
  if (pct === null) return '—'
  return `${pct.toFixed(1)}%`
}

/** Loss-making + incomplete recipes sort to the top (most actionable first). */
export function sortByActionability(recipes: RecipeCost[]): RecipeCost[] {
  return [...recipes].sort((a, b) => {
    const score = (r: RecipeCost) =>
      (r.marginPaise < 0 ? 2 : 0) + (r.incompleteCosting ? 1 : 0)
    const diff = score(b) - score(a)
    if (diff !== 0) return diff
    return (a.marginPct ?? Infinity) - (b.marginPct ?? Infinity)
  })
}
