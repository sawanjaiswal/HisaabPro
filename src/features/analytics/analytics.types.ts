/** Predictive analytics (#146) — FE types, mirrored from the backend
 * forecast service. All money in paise (Int). */

export interface RevenuePoint {
  /** First day of the month, ISO YYYY-MM-DD (UTC). */
  month: string
  revenuePaise: number
  /** True for forward-projected months (dashed in the chart). */
  projected: boolean
}

export interface RevenueForecast {
  points: RevenuePoint[]
  /** Projected revenue for the next month (paise). */
  nextMonthPaise: number
  /** Month-over-month change %, null when the prior month had no revenue. */
  momChangePct: number | null
  /** Months of history the trend was fit on. */
  basisMonths: number
}

export interface StockForecastItem {
  productId: string
  name: string
  currentStock: number
  /** Average units sold per day over the window. */
  dailyVelocity: number
  /** Days until stock hits zero; null when nothing is selling. */
  daysToStockOut: number | null
  /** ISO YYYY-MM-DD of the projected stock-out, or null. */
  stockOutDate: string | null
  /** True when stock-out lands within the reorder horizon. */
  reorderSoon: boolean
}

export interface StockForecast {
  items: StockForecastItem[]
  windowDays: number
  horizonDays: number
}
