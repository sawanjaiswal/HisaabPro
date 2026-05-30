/**
 * Commission #128 — Leaderboard table (admin view).
 *
 * Renders the period leaderboard with client-side resort via the sort
 * selector. Server returns entries already ordered by amount desc — the
 * sort key just re-orders the same payload (no refetch).
 *
 * Mobile (<md): card view via <ResponsiveTable>. Desktop (≥md): real
 * table with sticky header. Loading / error / empty states are first-
 * class on <ResponsiveTable> so this file stays small.
 */

import { useMemo, useState } from 'react'
import { Crown, Trophy } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Skeleton } from '@/components/feedback/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Select, SelectItem } from '@/components/ui/Select'
import {
  ResponsiveTable,
  type TableColumn,
} from '@/components/layout/ResponsiveTable'
import { formatPaise } from '@/lib/format'
import { SORT_LABEL_KEY, SORT_OPTIONS } from '../commission.constants'
import { sortLeaderboard } from '../commission.utils'
import type {
  CommissionLeaderboardRowDTO,
  LeaderboardSortKey,
} from '../commission.types'
import '@/styles/components.commission.css'

interface LeaderboardTableProps {
  rows: readonly CommissionLeaderboardRowDTO[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

export function LeaderboardTable({
  rows,
  isLoading,
  isError,
  onRetry,
}: LeaderboardTableProps) {
  const { t } = useLanguage()
  const [sort, setSort] = useState<LeaderboardSortKey>('amount')
  const sorted = useMemo(() => sortLeaderboard(rows, sort), [rows, sort])

  if (isLoading) {
    return (
      <div className="commission-leaderboard" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height="64px" borderRadius="var(--radius-md)" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <ErrorState message={t.commissionLeaderboardLoadFailed} onRetry={onRetry} />
  }

  const empty = (
    <EmptyState
      icon={<Trophy size={22} aria-hidden="true" />}
      title={t.commissionLeaderboardEmptyTitle}
      description={t.commissionLeaderboardEmptyDesc}
    />
  )

  const columns: TableColumn<CommissionLeaderboardRowDTO>[] = [
    {
      key: 'rank',
      header: t.commissionLeaderboardRankHeader,
      width: 'w-16',
      render: (row) => {
        const idx = sorted.indexOf(row)
        return (
          <span className="commission-leaderboard__rank">
            {idx === 0 ? <Crown size={14} aria-hidden="true" /> : idx + 1}
          </span>
        )
      },
    },
    {
      key: 'name',
      header: t.commissionLeaderboardStaffHeader,
      render: (row) => row.staffName ?? t.commissionLeaderboardUnknownStaff,
    },
    {
      key: 'amount',
      header: t.commissionLeaderboardAmountHeader,
      align: 'right',
      render: (row) => (
        <span className="tabular-nums">{formatPaise(row.totalCommissionPaise)}</span>
      ),
    },
    {
      key: 'sale_count',
      header: t.commissionLeaderboardCountHeader,
      align: 'right',
      render: (row) => <span className="tabular-nums">{row.rowCount}</span>,
    },
  ]

  return (
    <div className="commission-leaderboard">
      <div className="commission-leaderboard__sort-row">
        <label htmlFor="commission-sort" className="commission-leaderboard__sort-label">
          {t.commissionLeaderboardSortLabel}
        </label>
        <Select
          value={sort}
          onValueChange={(v) => setSort(v as LeaderboardSortKey)}
          ariaLabel={t.commissionLeaderboardSortLabel}
        >
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {t[SORT_LABEL_KEY[opt] as keyof typeof t] as string}
            </SelectItem>
          ))}
        </Select>
      </div>

      <ResponsiveTable<CommissionLeaderboardRowDTO>
        columns={columns}
        rows={sorted}
        rowKey={(r) => r.staffUserId}
        empty={empty}
      />
    </div>
  )
}
