/** Cash Register — History panel: summary header + controls + list */

import { useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { CashSummaryHeader } from './CashSummaryHeader'
import { HistoryControls } from './HistoryControls'
import { HistoryList } from './HistoryList'
import { useCashSummary, useCashHistory } from '../useCashRegisterQueries'
import { applyHistoryView, getTzOffsetMinutes } from '../cashRegister.utils'
import type { CashHistoryFilter, CashHistorySort, CashEntryDTO } from '../cashRegister.types'

interface Props {
  onEdit: (id: string) => void
  onVoid: (id: string) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
}

const DEFAULT_FILTER: CashHistoryFilter = { includeVoided: false }
const DEFAULT_SORT: CashHistorySort = { by: 'newest' }

function emptyLabel(filter: CashHistoryFilter): string {
  if (filter.direction === 'IN') return 'No Cash In entries'
  if (filter.direction === 'OUT') return 'No Cash Out entries'
  return 'No cash entries yet'
}

export function HistoryPanel({ onEdit, onVoid, onRestore, onDelete }: Props) {
  const { user } = useAuth()
  const businessId = user?.businessId ?? ''
  const isOwner = (user as { role?: string } | null)?.role === 'OWNER'
  const tzOffsetMinutes = useMemo(() => getTzOffsetMinutes(), [])

  const [filter, setFilter] = useState<CashHistoryFilter>(DEFAULT_FILTER)
  const [sort, setSort] = useState<CashHistorySort>(DEFAULT_SORT)

  const summaryQuery = useCashSummary(businessId, tzOffsetMinutes)
  const historyQuery = useCashHistory(businessId, filter, sort, tzOffsetMinutes)

  const allEntries: CashEntryDTO[] = useMemo(
    () => historyQuery.data?.pages.flatMap((p) => p.entries) ?? [],
    [historyQuery.data],
  )

  const buckets = useMemo(
    () => applyHistoryView(allEntries, filter, sort),
    [allEntries, filter, sort],
  )

  const handleRetry = useCallback(() => {
    void historyQuery.refetch()
  }, [historyQuery])

  const handleLoadMore = useCallback(() => {
    if (historyQuery.hasNextPage && !historyQuery.isFetchingNextPage) {
      void historyQuery.fetchNextPage()
    }
  }, [historyQuery])

  return (
    <div className="cr-history-panel">
      <CashSummaryHeader
        summary={summaryQuery.data}
        isLoading={summaryQuery.isLoading}
        isError={summaryQuery.isError}
      />

      <HistoryControls
        filter={filter}
        sort={sort}
        onFilterChange={setFilter}
        onSortChange={setSort}
      />

      <HistoryList
        buckets={buckets}
        isLoading={historyQuery.isLoading}
        isError={historyQuery.isError}
        hasNextPage={historyQuery.hasNextPage}
        isFetchingNextPage={historyQuery.isFetchingNextPage}
        onLoadMore={handleLoadMore}
        onEdit={onEdit}
        onVoid={onVoid}
        onRestore={onRestore}
        onDelete={onDelete}
        onRetry={handleRetry}
        isOwner={isOwner}
        filterLabel={emptyLabel(filter)}
      />
    </div>
  )
}
