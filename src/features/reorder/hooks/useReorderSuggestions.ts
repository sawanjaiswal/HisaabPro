/** useReorderSuggestions (#148) — velocity-based reorder list. */

import { useQuery } from '@tanstack/react-query'
import { getReorderSuggestions } from '../reorder.service'
import {
  REORDER_LEAD_TIME_DAYS,
  REORDER_COVERAGE_DAYS,
  reorderKeys,
} from '../reorder.constants'

export function useReorderSuggestions(
  onlyNeeded: boolean,
  leadTimeDays: number = REORDER_LEAD_TIME_DAYS,
  coverageDays: number = REORDER_COVERAGE_DAYS,
) {
  return useQuery({
    queryKey: reorderKeys.list(onlyNeeded, leadTimeDays, coverageDays),
    queryFn: ({ signal }) =>
      getReorderSuggestions(onlyNeeded, leadTimeDays, coverageDays, signal),
    staleTime: 2 * 60_000,
  })
}
