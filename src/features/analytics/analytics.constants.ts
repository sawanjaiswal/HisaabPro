/** Predictive analytics (#146) — query defaults + cache keys. */

/** Months of history fed to the revenue trend (backend min 3, max 24). */
export const REVENUE_BASIS_MONTHS = 6
/** Months projected forward (backend min 1, max 6). */
export const REVENUE_HORIZON_MONTHS = 3

/** Sales-velocity lookback window in days (backend min 7, max 180). */
export const STOCK_WINDOW_DAYS = 30
/** Flag products projected to run out within this many days. */
export const STOCK_HORIZON_DAYS = 14
/** Max products listed, soonest stock-out first. */
export const STOCK_LIMIT = 20

export const analyticsKeys = {
  revenue: (months: number, horizon: number) =>
    ['analytics', 'revenue-forecast', months, horizon] as const,
  stock: (windowDays: number, horizonDays: number, limit: number) =>
    ['analytics', 'stock-forecast', windowDays, horizonDays, limit] as const,
}
