/** Day Book — All transactions for a single day, chronological (lazy loaded) */

import { useCallback } from 'react'
import { Calendar } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ROUTES } from '@/config/routes.config'
import { useDayBook } from './hooks/useDayBook'
import { exportReport } from './report.service'
import { DAY_BOOK_TYPE_LABELS } from './report.constants'
import { ReportDateNavigator } from './components/ReportDateNavigator'
import { ReportFilterPills } from './components/ReportFilterPills'
import { ReportCardList } from './components/ReportCardList'
import { ReportLoadMore } from './components/ReportLoadMore'
import { ReportExportBar } from './components/ReportExportBar'
import { ReportSkeleton } from './components/ReportSkeleton'
import { DayBookSummaryBar } from './components/DayBookSummaryBar'
import { DayBookTransactionCard } from './components/DayBookTransactionCard'
import type { DayBookTransactionType } from './report.types'
import './report-shared.css'
import './report-cards.css'
import './report-shared-ui.css'
import './report-day-book.css'
import { useLanguage } from '@/hooks/useLanguage'

// ─── Type filter options ───────────────────────────────────────────────────────

const TYPE_FILTER_OPTIONS_BASE = Object.entries(DAY_BOOK_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
)

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DayBookPage() {
  const { t } = useLanguage()
  const {
    data,
    status,
    filters,
    setTypeFilter,
    loadMore,
    refresh,
    goToPrevDay,
    goToNextDay,
  } = useDayBook()

  const handleExport = useCallback(() => {
    exportReport({
      reportType: 'day_book',
      format: 'CSV',
      filters: { ...filters },
    }).catch(() => { /* download handled internally */ })
  }, [filters])

  const typeFilterOptions = [
    { value: '', label: t.all },
    ...TYPE_FILTER_OPTIONS_BASE,
  ]

  const isLoadingMore = status === 'loading' && data !== null

  const dayLabel = data?.data.dayLabel ?? ''
  const summary = data?.data.summary
  const transactions = data?.data.transactions ?? []
  const hasMore = data?.meta.hasMore ?? false
  const canGoNext = (data?.data.navigation.nextDate ?? null) !== null
  const hasTransactions = transactions.length > 0

  // ─── Loading state ───────────────────────────────────────────────────────────

  if (status === 'loading' && data === null) {
    return (
      <AppShell>
        <Header title={t.dayBook} backTo={ROUTES.REPORTS} />
        <PageContainer variant="list" className="space-y-6">
          <ReportSkeleton rows={6} />
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Error state ─────────────────────────────────────────────────────────────

  if (status === 'error' && data === null) {
    return (
      <AppShell>
        <Header title={t.dayBook} backTo={ROUTES.REPORTS} />
        <PageContainer variant="list" className="space-y-6">
          <ErrorState
            title={t.couldNotLoadDayBook}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Success + Empty states ──────────────────────────────────────────────────

  return (
    <AppShell>
      <Header title={t.dayBook} backTo={ROUTES.REPORTS} />

      <PageContainer variant="list" className="space-y-6">
        {/* Date navigator */}
        <ReportDateNavigator
          date={filters.date}
          dayLabel={dayLabel}
          onPrev={goToPrevDay}
          onNext={goToNextDay}
          canGoNext={canGoNext}
        />

        {/* Transaction type filter */}
        <div className="report-filter-bar stagger-filters">
          <ReportFilterPills
            options={typeFilterOptions}
            activeValue={filters.type ?? ''}
            onChange={(v) =>
              setTypeFilter(v ? (v as DayBookTransactionType) : undefined)
            }
            ariaLabel={t.filterByTransactionType}
          />
        </div>

        {/* Day summary card */}
        {summary !== undefined && (
          <DayBookSummaryBar summary={summary} />
        )}

        {/* Empty state */}
        {!hasTransactions && status === 'success' && (
          <EmptyState
            icon={<Calendar size={22} aria-hidden="true" />}
            title={dayLabel ? `${t.noTransactionsOn} ${dayLabel}` : `${t.noTransactionsForThisDay}`}
            description={filters.type ? t.tryClearingTypeFilter : t.noActivityRecorded}
          />
        )}

        {/* Transaction list */}
        {hasTransactions && (
          <ReportCardList ariaLabel={t.dayBookTransactions}>
            {transactions.map((txn) => (
              <DayBookTransactionCard key={txn.id} transaction={txn} />
            ))}
          </ReportCardList>
        )}

        {/* Load more */}
        <ReportLoadMore
          hasMore={hasMore}
          isLoading={isLoadingMore}
          onLoadMore={loadMore}
        />

        {/* Export — PDF only for day book */}
        <ReportExportBar
          onExport={handleExport}
          disabled={!hasTransactions}
        />
      </PageContainer>
    </AppShell>
  )
}
