/**
 * Commission #128 — Per-staff, per-period ledger hook (infinite cursor scroll).
 *
 * Server orders by `createdAt desc, id desc` (architecture §4.3). The cursor
 * is opaque; we just pass `lastPage.nextCursor` to fetchNextPage.
 *
 * 404 STAFF_NOT_FOUND handling (M4):
 *   - When the caller passes another staff member's ID and they are not in
 *     the tenant, the server returns 404 STAFF_NOT_FOUND. We catch via
 *     `onError` → toast (`commissionStaffNotFoundToast`) and surface a
 *     "not-found" status so the page degrades to an empty state instead of
 *     a generic error.
 *
 * Cache key: queryKeys.commission.ledger({ staffUserId, periodYearMonth }).
 */

import { useCallback } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { ApiError } from '@/lib/api'
import { getLedger } from '../api/commission.service'
import {
  ERR_STAFF_NOT_FOUND,
  LEDGER_PAGE_SIZE,
} from '../commission.constants'
import type { CommissionLedgerRowDTO } from '../commission.types'

interface UseCommissionLedgerArgs {
  periodYearMonth: string
  /** Caller's own user ID = self-view (no staffUserId in query). */
  staffUserId?: string
  enabled?: boolean
  pageSize?: number
  /** Called once when a 404 STAFF_NOT_FOUND surfaces (cross-tenant probe). */
  onStaffNotFound?: () => void
}

export type LedgerStatus = 'idle' | 'loading' | 'error' | 'success' | 'not-found'

interface UseCommissionLedgerReturn {
  rows: CommissionLedgerRowDTO[]
  summary: { totalCommissionPaise: number; rowCount: number } | null
  status: LedgerStatus
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  refresh: () => void
}

export function useCommissionLedger({
  periodYearMonth,
  staffUserId,
  enabled = true,
  pageSize = LEDGER_PAGE_SIZE,
  onStaffNotFound,
}: UseCommissionLedgerArgs): UseCommissionLedgerReturn {
  const qc = useQueryClient()
  const isEnabled = Boolean(periodYearMonth) && enabled

  const query = useInfiniteQuery({
    queryKey: queryKeys.commission.ledger({ staffUserId: staffUserId ?? '__self__', periodYearMonth }),
    queryFn: ({ pageParam }) =>
      getLedger({
        periodYearMonth,
        staffUserId,
        cursor: pageParam as string | undefined,
        limit: pageSize,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isEnabled,
    // Don't auto-retry 404s — the staff genuinely doesn't exist.
    retry: (failureCount, err) => {
      if (err instanceof ApiError && err.code === ERR_STAFF_NOT_FOUND) return false
      return failureCount < 2
    },
  })

  // Surface 404 to the page via a callback so it can show a toast.
  const isStaffNotFound =
    query.error instanceof ApiError && query.error.code === ERR_STAFF_NOT_FOUND
  if (isStaffNotFound && onStaffNotFound) onStaffNotFound()

  const rows = query.data?.pages.flatMap((p) => p.rows) ?? []
  const summary = query.data?.pages[0]?.summary ?? null

  const status: LedgerStatus = !isEnabled
    ? 'idle'
    : query.isPending
      ? 'loading'
      : isStaffNotFound
        ? 'not-found'
        : query.isError
          ? 'error'
          : 'success'

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: queryKeys.commission.all() })
    void query.refetch()
  }, [qc, query])

  return {
    rows,
    summary,
    status,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refresh,
  }
}
