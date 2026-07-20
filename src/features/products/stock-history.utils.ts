/** Stock history (mockup #67) — filtering and month grouping for the tab. */

import type { StockMovement, StockMovementType } from './product.types'

/** The mockup's four segments. */
export type StockHistoryFilter = 'ALL' | 'IN' | 'OUT' | 'ADJUSTMENTS'

const IN_TYPES = new Set<StockMovementType>([
  'PURCHASE', 'ADJUSTMENT_IN', 'OPENING', 'RETURN_IN',
])

const ADJUSTMENT_TYPES = new Set<StockMovementType>(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'])

export function isInbound(type: StockMovementType): boolean {
  return IN_TYPES.has(type)
}

export function filterMovements(
  movements: StockMovement[],
  filter: StockHistoryFilter,
): StockMovement[] {
  if (filter === 'ALL') return movements
  if (filter === 'ADJUSTMENTS') return movements.filter((m) => ADJUSTMENT_TYPES.has(m.type))
  const wantInbound = filter === 'IN'
  return movements.filter((m) => isInbound(m.type) === wantInbound)
}

export interface MovementGroup {
  /** "June 2025" — the mockup's sticky-ish month band. */
  label: string
  movements: StockMovement[]
}

/**
 * Group by month in arrival order. The list is already newest-first from the
 * server, so preserving order keeps the months descending without a re-sort.
 */
export function groupByMonth(movements: StockMovement[]): MovementGroup[] {
  const groups: MovementGroup[] = []

  for (const movement of movements) {
    const label = new Date(movement.createdAt).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    })
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.movements.push(movement)
    else groups.push({ label, movements: [movement] })
  }

  return groups
}
