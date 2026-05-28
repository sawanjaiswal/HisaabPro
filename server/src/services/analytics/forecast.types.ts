/**
 * Predictive analytics (#146) — shared types.
 *
 * All money fields are paise (Int), matching the rest of the wire contract.
 * Forecasts use deterministic statistics (linear least-squares trend + sales
 * velocity), never an opaque model — every number is explainable to the user.
 */

/** One historical or projected revenue bucket (calendar month). */
export interface RevenuePoint {
  /** First day of the month, ISO date (YYYY-MM-DD). */
  month: string
  /** Revenue for the month in paise. Projected points are rounded, floored at 0. */
  revenuePaise: number
  /** True for model-projected months, false for observed history. */
  projected: boolean
}

export interface RevenueForecast {
  points: RevenuePoint[]
  /** Projected revenue for the next month in paise. */
  nextMonthPaise: number
  /**
   * Projected next-month revenue vs. the last observed month, as a signed
   * percentage (e.g. 12.5 = +12.5%). null when there is no prior month to
   * compare against (cold start).
   */
  momChangePct: number | null
  /** Number of observed months the trend was fitted on. */
  basisMonths: number
}

/** Per-product stock-out projection, sorted soonest-first. */
export interface StockForecastItem {
  productId: string
  name: string
  currentStock: number
  /** Average units sold per day over the lookback window. */
  dailyVelocity: number
  /** Whole days until stock reaches zero at current velocity; null if no sales. */
  daysToStockOut: number | null
  /** ISO date the product is projected to run out; null if no sales. */
  stockOutDate: string | null
  /** True when daysToStockOut is within the reorder horizon. */
  reorderSoon: boolean
}

export interface StockForecast {
  items: StockForecastItem[]
  /** Lookback window the velocity was measured over, in days. */
  windowDays: number
  /** Reorder horizon used to flag `reorderSoon`, in days. */
  horizonDays: number
}
