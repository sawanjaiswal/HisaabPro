/**
 * CRM (#127) — useTagSummary hook.
 *
 * Wraps `getTagSummary` in TanStack Query so the TagFilterBar can render
 * stale-while-revalidate as users edit parties and tags appear/disappear.
 * Cache key lives in `queryKeys.crm.tags()` (SSOT in src/lib/query-keys.ts).
 *
 * No `cacheReads` opt-in — the tag aggregate carries no PII (it's just
 * counts) but it MUST stay fresh as parties are edited so we deliberately
 * skip persistence.
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { getTagSummary } from '../api/crm.service'
import type { TagSummaryPage } from '../crm.types'

interface UseTagSummaryReturn {
  data: TagSummaryPage | null
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

export function useTagSummary(): UseTagSummaryReturn {
  const query = useQuery({
    queryKey: queryKeys.crm.tags(),
    queryFn: ({ signal }) => getTagSummary(signal),
    staleTime: 30_000,  // 30s — tags rarely churn faster than this
  })

  return {
    data: query.data ?? null,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: () => { void query.refetch() },
  }
}
