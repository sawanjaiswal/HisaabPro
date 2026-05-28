/** useRevenueForecast (#146) — monthly revenue trend + projection. */

import { useQuery } from '@tanstack/react-query'
import { getRevenueForecast } from '../analytics.service'
import {
  REVENUE_BASIS_MONTHS,
  REVENUE_HORIZON_MONTHS,
  analyticsKeys,
} from '../analytics.constants'

export function useRevenueForecast(
  months: number = REVENUE_BASIS_MONTHS,
  horizon: number = REVENUE_HORIZON_MONTHS,
) {
  return useQuery({
    queryKey: analyticsKeys.revenue(months, horizon),
    queryFn: ({ signal }) => getRevenueForecast(months, horizon, signal),
    staleTime: 5 * 60_000,
  })
}
