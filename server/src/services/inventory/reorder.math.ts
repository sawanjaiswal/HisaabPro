/** Smart inventory (#148) — pure reorder math.
 *
 * Deterministic and explainable: no model, just velocity × time-to-cover.
 * Velocity / stock-out come from the shared analytics math (forecast.math). */

import type { ReorderUrgency } from './reorder.types.js'

/**
 * Units to reorder so stock covers demand over the restock lead time plus a
 * target coverage window. Rounds up (you can't order a fraction of a unit
 * for most goods) and never returns negative. Returns 0 when nothing sells.
 */
export function suggestedReorderQty(
  velocity: number,
  leadTimeDays: number,
  coverageDays: number,
  currentStock: number,
): number {
  if (velocity <= 0) return 0
  const targetStock = velocity * (leadTimeDays + coverageDays)
  const deficit = targetStock - currentStock
  return deficit <= 0 ? 0 : Math.ceil(deficit)
}

/** Reorder cost in paise. Rounds to the nearest paisa. */
export function reorderValuePaise(qty: number, unitCostPaise: number): number {
  if (qty <= 0 || unitCostPaise <= 0) return 0
  return Math.round(qty * unitCostPaise)
}

/**
 * How urgent the reorder is:
 *  - 'out'      — already at/below zero stock
 *  - 'critical' — will run out before a restock could arrive (≤ lead time)
 *  - 'low'      — will run out within the lead + coverage horizon
 *  - 'ok'       — comfortable, or not selling (null stock-out)
 */
export function reorderUrgency(
  currentStock: number,
  daysToStockOut: number | null,
  leadTimeDays: number,
  coverageDays: number,
): ReorderUrgency {
  if (currentStock <= 0) return 'out'
  if (daysToStockOut === null) return 'ok'
  if (daysToStockOut <= leadTimeDays) return 'critical'
  if (daysToStockOut <= leadTimeDays + coverageDays) return 'low'
  return 'ok'
}

/** Sort weight — lower sorts first (most urgent on top). */
export function urgencyRank(urgency: ReorderUrgency): number {
  switch (urgency) {
    case 'out':
      return 0
    case 'critical':
      return 1
    case 'low':
      return 2
    default:
      return 3
  }
}
