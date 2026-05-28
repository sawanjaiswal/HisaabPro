/**
 * Pure forecasting statistics for #146. No DB, no I/O — every function is a
 * deterministic transform so it can be unit-tested in isolation.
 */

export interface LinearFit {
  slope: number
  intercept: number
}

/**
 * Ordinary least-squares fit over points (0, ys[0]), (1, ys[1]), … so the
 * caller can project future indices. Returns a flat line (slope 0) when there
 * are fewer than two points, since a trend is undefined on a single sample.
 */
export function linearFit(ys: number[]): LinearFit {
  const n = ys.length
  if (n === 0) return { slope: 0, intercept: 0 }
  if (n === 1) return { slope: 0, intercept: ys[0] }

  // x runs 0..n-1; meanX is (n-1)/2.
  const meanX = (n - 1) / 2
  const meanY = ys.reduce((a, b) => a + b, 0) / n

  let num = 0
  let den = 0
  for (let x = 0; x < n; x++) {
    const dx = x - meanX
    num += dx * (ys[x] - meanY)
    den += dx * dx
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = meanY - slope * meanX
  return { slope, intercept }
}

/**
 * Project the next `periods` values by extrapolating the linear fit. Values are
 * rounded to integers (paise) and floored at 0 — revenue/units can't go
 * negative even when the fitted trend points downward.
 */
export function projectLinear(history: number[], periods: number): number[] {
  const fit = linearFit(history)
  const start = history.length
  const out: number[] = []
  for (let i = 0; i < periods; i++) {
    const x = start + i
    const y = fit.slope * x + fit.intercept
    out.push(Math.max(0, Math.round(y)))
  }
  return out
}

/**
 * Signed percentage change from `prev` to `next`. null when there is no
 * meaningful baseline (prev <= 0), so callers can render "—" instead of ∞.
 */
export function percentChange(prev: number, next: number): number | null {
  if (prev <= 0) return null
  return ((next - prev) / prev) * 100
}

/** Average units sold per day. 0 when the window is non-positive. */
export function dailyVelocity(unitsSold: number, windowDays: number): number {
  if (windowDays <= 0) return 0
  return unitsSold / windowDays
}

/**
 * Whole days until stock reaches zero at the given velocity. null when there
 * are no sales (velocity <= 0) — the product isn't moving, so "days to
 * stock-out" is undefined rather than infinite.
 */
export function daysToStockOut(currentStock: number, velocity: number): number | null {
  if (velocity <= 0) return null
  if (currentStock <= 0) return 0
  return Math.floor(currentStock / velocity)
}

/** ISO date (YYYY-MM-DD) `days` from `from`, in UTC. */
export function addDaysIso(from: Date, days: number): string {
  const d = new Date(from.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
