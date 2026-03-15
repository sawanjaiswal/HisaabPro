/** Day Book — All transactions for a single day, chronological (lazy loaded) */

import { useCallback } from 'react'
import { Calendar } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { useDayBook } from './hooks/useDayBook'
import { exportReport } from './report.service'
import { formatAmount } from './report.utils'
import {
  DAY_BOOK_TYPE_LABELS,
  DAY_BOOK_TYPE_COLORS,
} from './report.constants'
import { ReportDateNavigator } from './components/ReportDateNavigator'
import { ReportFilterPills } from './components/ReportFilterPills'
import { ReportCardList } from './components/ReportCardList'
import { ReportLoadMore } from './components/ReportLoadMore'
import { ReportExportBar } from './components/ReportExportBar'
import { ReportSkeleton } from './components/ReportSkeleton'
import type { DayBookTransactionType } from './report.types'
import './reports.css'

// ─── Type filter options ───────────────────────────────────────────────────────

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  ...Object.entries(DAY_BOOK_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
]

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DayBookPage() {
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
      reportType: 'day-book',
      format: 'pdf',
      filters: { ...filters },
    }).then((res) => {
      window.open(res.data.fileUrl, '_blank', 'noopener,noreferrer')
    })
  }, [filters])

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
        <Header title="Day Book" backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ReportSkeleton rows={6} />
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Error state ─────────────────────────────────────────────────────────────

  if (status === 'error' && data === null) {
    return (
      <AppShell>
        <Header title="Day Book" backTo={ROUTES.REPORTS} />
        <PageContainer>
          <div className="report-empty">
            <div className="report-empty-icon" aria-hidden="true">
              <Calendar size={28} />
            </div>
            <p className="report-empty-title">Could not load day book</p>
            <p className="report-empty-desc">
              Check your connection and try again.
            </p>
            <button
              className="report-load-more-btn"
              onClick={refresh}
              type="button"
              aria-label="Retry loading day book"
            >
              Retry
            </button>
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Success + Empty states ──────────────────────────────────────────────────

  return (
    <AppShell>
      <Header title="Day Book" backTo={ROUTES.REPORTS} />

      <PageContainer>
        {/* Date navigator */}
        <ReportDateNavigator
          date={filters.date}
          dayLabel={dayLabel}
          onPrev={goToPrevDay}
          onNext={goToNextDay}
          canGoNext={canGoNext}
        />

        {/* Transaction type filter */}
        <div className="report-filter-bar">
          <ReportFilterPills
            options={TYPE_FILTER_OPTIONS}
            activeValue={filters.type ?? ''}
            onChange={(v) =>
              setTypeFilter(v ? (v as DayBookTransactionType) : undefined)
            }
            ariaLabel="Filter by transaction type"
          />
        </div>

        {/* Day summary card */}
        {summary !== undefined && (
          <div className="report-summary-bar" role="region" aria-label="Day totals">
            <div className="report-summary-item">
              <span className="report-summary-label">Sales</span>
              <span className="report-summary-value report-summary-value--primary">
                {formatAmount(summary.totalSales.amount)}
              </span>
              <span className="report-summary-count">
                {summary.totalSales.count} txn
              </span>
            </div>
            <div className="report-summary-item">
              <span className="report-summary-label">Purchases</span>
              <span className="report-summary-value">
                {formatAmount(summary.totalPurchases.amount)}
              </span>
              <span className="report-summary-count">
                {summary.totalPurchases.count} txn
              </span>
            </div>
            <div className="report-summary-item">
              <span className="report-summary-label">Pay In</span>
              <span className="report-summary-value report-summary-value--positive">
                {formatAmount(summary.paymentsIn.amount)}
              </span>
              <span className="report-summary-count">
                {summary.paymentsIn.count} txn
              </span>
            </div>
            <div className="report-summary-item">
              <span className="report-summary-label">Pay Out</span>
              <span className="report-summary-value report-summary-value--negative">
                {formatAmount(summary.paymentsOut.amount)}
              </span>
              <span className="report-summary-count">
                {summary.paymentsOut.count} txn
              </span>
            </div>
            <div className="report-summary-item">
              <span className="report-summary-label">Net Cash</span>
              <span
                className={
                  summary.netCashFlow >= 0
                    ? 'report-summary-value report-summary-value--positive'
                    : 'report-summary-value report-summary-value--negative'
                }
              >
                {formatAmount(summary.netCashFlow)}
              </span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasTransactions && status === 'success' && (
          <div className="report-empty">
            <div className="report-empty-icon" aria-hidden="true">
              <Calendar size={28} />
            </div>
            <p className="report-empty-title">
              No transactions{dayLabel ? ` on ${dayLabel}` : ' for this day'}.
            </p>
            <p className="report-empty-desc">
              {filters.type
                ? 'Try clearing the type filter to see all entries.'
                : 'No activity was recorded for this date.'}
            </p>
          </div>
        )}

        {/* Transaction list */}
        {hasTransactions && (
          <ReportCardList ariaLabel="Day book transactions">
            {transactions.map((txn) => (
              <div key={txn.id} className="report-card" role="listitem">
                <div className="report-card-header">
                  <span className="report-daybook-time">{txn.time}</span>
                  <span
                    className="report-daybook-type"
                    style={{ color: DAY_BOOK_TYPE_COLORS[txn.type] }}
                  >
                    {DAY_BOOK_TYPE_LABELS[txn.type]}
                  </span>
                </div>
                <div className="report-card-body">
                  <span>{txn.description}</span>
                  {txn.partyName !== '' && (
                    <span className="report-card-party">{txn.partyName}</span>
                  )}
                </div>
                <div className="report-card-footer">
                  <span className="report-card-amount">
                    {formatAmount(txn.amount)}
                  </span>
                  {txn.reference !== '' && (
                    <span className="report-card-ref">{txn.reference}</span>
                  )}
                </div>
                <div className="report-divider" />
              </div>
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
