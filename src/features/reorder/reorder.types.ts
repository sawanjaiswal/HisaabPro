/** Smart inventory (#148) — FE types, mirrored from the backend reorder
 * service. All money in paise (Int). */

export type ReorderUrgency = 'out' | 'critical' | 'low' | 'ok'

export interface ReorderSuggestion {
  productId: string
  name: string
  sku: string | null
  unitSymbol: string
  currentStock: number
  dailyVelocity: number
  daysToStockOut: number | null
  stockOutDate: string | null
  minStockLevel: number
  manualReorderQty: number | null
  suggestedReorderQty: number
  unitCostPaise: number
  reorderValuePaise: number
  urgency: ReorderUrgency
}

export interface ReorderSummary {
  totalProducts: number
  needReorderCount: number
  totalSuggestedValuePaise: number
}

export interface ReorderForecast {
  items: ReorderSuggestion[]
  summary: ReorderSummary
  windowDays: number
  leadTimeDays: number
  coverageDays: number
}
