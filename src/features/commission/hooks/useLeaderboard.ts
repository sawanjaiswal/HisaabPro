/**
 * Commission #128 — Leaderboard hook.
 *
 * Server returns `entries` sorted by total amount desc. We allow client-side
 * resort via `commission.utils#sortLeaderboard`.
 *
 * Permission gate: this endpoint requires `commission.view_all` server-side.
 * If the user lacks the permission, the server returns 403 FORBIDDEN. We
 * surface that via the standard `isError` + a `forbidden` flag so the page
 * can show a friendly empty-permission state instead of "Something went
 * wrong".
 */

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { ApiError } from '@/lib/api'
import { getLeaderboard } from '../api/commission.service'
import { LEADERBOARD_DEFAULT_LIMIT } from '../commission.constants'
import type {
  CommissionLeaderboardResponseDTO,
} from '../commission.types'

interface UseLeaderboardArgs {
  periodYearMonth: string
  limit?: number
  enabled?: boolean
}

interface UseLeaderboardReturn {
  data: CommissionLeaderboardResponseDTO | null
  status: 'loading' | 'error' | 'success' | 'forbidden' | 'idle'
  refresh: () => void
}

export function useLeaderboard({
  periodYearMonth,
  limit = LEADERBOARD_DEFAULT_LIMIT,
  enabled = true,
}: UseLeaderboardArgs): UseLeaderboardReturn {
  const qc = useQueryClient()
  const isEnabled = Boolean(periodYearMonth) && enabled

  const q = useQuery({
    queryKey: queryKeys.commission.leaderboard({ periodYearMonth, limit }),
    queryFn: () => getLeaderboard({ periodYearMonth, limit }),
    enabled: isEnabled,
    staleTime: 30_000,
    retry: (failureCount, err) => {
      // No retry on 403 — the user lacks the permission, no amount of
      // retrying will change that.
      if (err instanceof ApiError && err.status === 403) return false
      return failureCount < 2
    },
  })

  const isForbidden = q.error instanceof ApiError && q.error.status === 403

  const status: UseLeaderboardReturn['status'] = !isEnabled
    ? 'idle'
    : q.isPending
      ? 'loading'
      : isForbidden
        ? 'forbidden'
        : q.isError
          ? 'error'
          : 'success'

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: queryKeys.commission.all() })
    void q.refetch()
  }, [qc, q])

  return {
    data: q.data ?? null,
    status,
    refresh,
  }
}
