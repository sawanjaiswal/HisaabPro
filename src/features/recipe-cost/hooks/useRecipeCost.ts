/** useRecipeCost (V3) — derived cost-per-unit + margin for active recipes. */

import { useQuery } from '@tanstack/react-query'
import { getRecipeCostSummary } from '../recipe-cost.service'

export const recipeCostKeys = {
  summary: () => ['recipe-cost', 'summary'] as const,
}

export function useRecipeCost() {
  return useQuery({
    queryKey: recipeCostKeys.summary(),
    queryFn: ({ signal }) => getRecipeCostSummary(signal),
    staleTime: 5 * 60_000,
  })
}
