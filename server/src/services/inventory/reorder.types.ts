/** Smart inventory (#148) — velocity-based reorder suggestion types.
 *
 * A suggestion layer over the static manual reorderQty (#114): it reads
 * recent sales velocity and proposes how much to reorder to cover the
 * restock lead time plus a target coverage window. All money in paise. */

export type ReorderUrgency = 'out' | 'critical' | 'low' | 'ok'

export interface ReorderSuggestion {
  productId: string
  name: string
  sku: string | null
  unitSymbol: string
  currentStock: number
  /** Average units sold per day over the lookback window. */
  dailyVelocity: number
  /** Days until stock hits zero; null when nothing is selling. */
  daysToStockOut: number | null
  stockOutDate: string | null
  /** Existing manual threshold (#114), for context. */
  minStockLevel: number
  /** Existing manual reorder qty (#114), null when unset. */
  manualReorderQty: number | null
  /** Velocity-based quantity to bring stock up to lead+coverage demand. */
  suggestedReorderQty: number
  /** Per-unit cost in paise (weighted-avg, falling back to purchase price). */
  unitCostPaise: number
  /** suggestedReorderQty × unitCostPaise (paise). */
  reorderValuePaise: number
  urgency: ReorderUrgency
}

export interface ReorderSummary {
  /** Products with sales velocity in the window. */
  totalProducts: number
  /** Products flagged as needing a reorder (urgency !== 'ok'). */
  needReorderCount: number
  /** Sum of reorderValuePaise across returned suggestions. */
  totalSuggestedValuePaise: number
}

export interface ReorderForecast {
  items: ReorderSuggestion[]
  summary: ReorderSummary
  windowDays: number
  leadTimeDays: number
  coverageDays: number
}
