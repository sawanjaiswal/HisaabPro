/** Payment History — Page (thin composer: state + 4 UI states + composition) */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banknote } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { usePaymentHistoryReport } from './hooks/usePaymentHistoryReport'
import { exportReport } from './report.service'
import { formatAmount, getDateRange } from './report.utils'
import { DATE_RANGE_PRESETS } from './report.constants'
import { ReportSummaryBar } from './components/ReportSummaryBar'
import { ReportLoadMore } from './components/ReportLoadMore'
import { ReportExportBar } from './components/ReportExportBar'
import { ReportSkeleton } from './components/ReportSkeleton'
import { PaymentHistoryFilter } from './components/PaymentHistoryFilter'
import { PaymentHistoryList } from './components/PaymentHistoryList'
import { PaymentHistoryGrouped } from './components/PaymentHistoryGrouped'
import { PaymentHistoryEmpty } from './components/PaymentHistoryEmpty'
import type { ExportFormat } from './report.types'
import './report-shared.css'
import './report-cards.css'
import './report-shared-ui.css'
import { useLanguage } from '@/hooks/useLanguage'

export default function PaymentHistoryPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { data, status, filters, setFilter, loadMore, refresh } =
    usePaymentHistoryReport()

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const handleExport = useCallback(
    (format: ExportFormat) => {
      exportReport({
        reportType: 'payment_history',
        format,
        filters: { ...filters },
      }).catch(() => { /* download handled internally */ })
    },
    [filters],
  )

  const activeDatePreset: string =
    DATE_RANGE_PRESETS.find((p) => {
      const range = getDateRange(p)
      return range.from === filters.from && range.to === filters.to
    }) ?? 'this_month'

  const isLoadingMore = status === 'loading' && data !== null
  const summary = data?.data.summary
  const items = data?.data.items ?? []
  const groups = data?.data.groups ?? []
  const hasMore = data?.meta.hasMore ?? false
  const isGrouped = filters.groupBy !== 'none'
  const hasContent = isGrouped ? groups.length > 0 : items.length > 0
  const hasFiltersApplied =
    filters.type !== undefined ||
    filters.mode !== undefined ||
    filters.partyId !== undefined

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (status === 'loading' && data === null) {
    return (
      <AppShell>
        <Header title={t.paymentHistory} backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ReportSkeleton rows={7} />
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Error state ───────────────────────────────────────────────────────────

  if (status === 'error' && data === null) {
    return (
      <AppShell>
        <Header title={t.paymentHistory} backTo={ROUTES.REPORTS} />
        <PageContainer>
          <div className="report-empty">
            <div className="report-empty-icon" aria-hidden="true">
              <Banknote size={28} />
            </div>
            <p className="report-empty-title">{t.couldNotLoadPaymentHistory}</p>
            <p className="report-empty-desc">
              {t.checkConnectionRetry}
            </p>
            <button
              className="report-load-more-btn"
              onClick={refresh}
              type="button"
              aria-label={t.retryLoadingPaymentHistory}
            >
              Retry
            </button>
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Success + Empty states ────────────────────────────────────────────────

  return (
    <AppShell>
      <Header title={t.paymentHistory} backTo={ROUTES.REPORTS} />
      <PageContainer>
        <PaymentHistoryFilter
          filters={filters}
          activeDatePreset={activeDatePreset}
          setFilter={setFilter}
        />

        {summary !== undefined && (
          <ReportSummaryBar
            items={[
              {
                label: t.receivedLabel,
                value: formatAmount(summary.totalReceived),
                color: 'var(--color-success-600)',
              },
              {
                label: t.paid,
                value: formatAmount(summary.totalPaid),
                color: 'var(--color-error-600)',
              },
              {
                label: t.net,
                value: formatAmount(summary.net),
                color:
                  summary.net >= 0
                    ? 'var(--color-success-600)'
                    : 'var(--color-error-600)',
              },
              { label: t.inLabel, value: String(summary.countIn) },
              { label: t.outLabel, value: String(summary.countOut) },
            ]}
          />
        )}

        {!hasContent && status === 'success' && (
          <PaymentHistoryEmpty
            hasFiltersApplied={hasFiltersApplied}
            onNavigateNew={() => navigate(ROUTES.PAYMENT_NEW)}
            setFilter={setFilter}
          />
        )}

        {hasContent && !isGrouped && <PaymentHistoryList items={items} />}

        {hasContent && isGrouped && (
          <PaymentHistoryGrouped
            groups={groups}
            expandedGroups={expandedGroups}
            onToggleGroup={toggleGroup}
          />
        )}

        <ReportLoadMore
          hasMore={hasMore}
          isLoading={isLoadingMore}
          onLoadMore={loadMore}
        />

        <ReportExportBar onExport={handleExport} disabled={!hasContent} />
      </PageContainer>
    </AppShell>
  )
}
