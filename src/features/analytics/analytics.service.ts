/** Predictive analytics (#146) — read-only API calls.
 *
 * Reads are network-only: the forecasts contain per-tenant revenue and
 * stock figures, so they must not land in the offline read cache
 * (OFFLINE_RULES Rule 3). */

import { api } from '@/lib/api'
import type { RevenueForecast, StockForecast } from './analytics.types'

export async function getRevenueForecast(
  months: number,
  horizon: number,
  signal?: AbortSignal,
): Promise<RevenueForecast> {
  return api<RevenueForecast>(
    `/analytics/revenue-forecast?months=${months}&horizon=${horizon}`,
    { cacheReads: false, signal },
  )
}

export async function getStockForecast(
  windowDays: number,
  horizonDays: number,
  limit: number,
  signal?: AbortSignal,
): Promise<StockForecast> {
  return api<StockForecast>(
    `/analytics/stock-forecast?windowDays=${windowDays}&horizonDays=${horizonDays}&limit=${limit}`,
    { cacheReads: false, signal },
  )
}
