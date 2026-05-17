/**
 * CRM (#127) — useFollowUps hook (M3 — withinDays bounds enforcement).
 *
 * `withinDays` is clamped here AND on the server (architecture §3.5 /
 * security M3) — defence in depth. The chip-bar can only pick 7/30/90
 * but a stray query param or URL hack would still bounce off the cap.
 *
 * Uses an explicit error mapping for `INVALID_WITHIN_DAYS_RANGE` so
 * `<FollowUpsPage>` can show the localized "Range cannot exceed 365 days"
 * message rather than the generic ApiError.message.
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { ApiError } from '@/lib/api'
import { getFollowUps } from '../api/crm.service'
import type { FollowUpPage, FollowUpsQuery } from '../crm.types'

const WITHIN_DAYS_MIN = 1
const WITHIN_DAYS_MAX = 365

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 30
  if (n < WITHIN_DAYS_MIN) return WITHIN_DAYS_MIN
  if (n > WITHIN_DAYS_MAX) return WITHIN_DAYS_MAX
  return Math.trunc(n)
}

interface UseFollowUpsReturn {
  data: FollowUpPage | null
  isLoading: boolean
  isError: boolean
  /** True iff the server replied with INVALID_WITHIN_DAYS_RANGE (M3). */
  isRangeError: boolean
  errorMessage: string | null
  refetch: () => void
}

export function useFollowUps(query: FollowUpsQuery): UseFollowUpsReturn {
  const normalised: FollowUpsQuery = {
    withinDays: clamp(query.withinDays),
    cursor: query.cursor,
    limit: query.limit,
  }

  const q = useQuery({
    queryKey: queryKeys.crm.followUps(normalised),
    queryFn: ({ signal }) => getFollowUps(normalised, signal),
  })

  const isRangeError =
    q.error instanceof ApiError &&
    (q.error.code === 'INVALID_WITHIN_DAYS_RANGE' || q.error.status === 400)

  const errorMessage =
    q.error instanceof Error ? q.error.message : null

  return {
    data: q.data ?? null,
    isLoading: q.isPending,
    isError: q.isError,
    isRangeError,
    errorMessage,
    refetch: () => { void q.refetch() },
  }
}
