/** useStockForecast (#146) — per-product stock-out projection. */

import { useQuery } from '@tanstack/react-query'
import { getStockForecast } from '../analytics.service'
import {
  STOCK_WINDOW_DAYS,
  STOCK_HORIZON_DAYS,
  STOCK_LIMIT,
  analyticsKeys,
} from '../analytics.constants'

export function useStockForecast(
  windowDays: number = STOCK_WINDOW_DAYS,
  horizonDays: number = STOCK_HORIZON_DAYS,
  limit: number = STOCK_LIMIT,
) {
  return useQuery({
    queryKey: analyticsKeys.stock(windowDays, horizonDays, limit),
    queryFn: ({ signal }) => getStockForecast(windowDays, horizonDays, limit, signal),
    staleTime: 5 * 60_000,
  })
}
