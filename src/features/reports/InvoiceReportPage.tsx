/** Invoice Report — Sales or Purchase (lazy loaded)
 *
 * Determines report type from the current pathname:
 *   /reports/sales     → type = 'sale'
 *   /reports/purchases → type = 'purchase'
 */

import { useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { getDateRange } from './report.utils'
import { formatAmount } from './report.utils'
import { useInvoiceReport } from './hooks/useInvoiceReport'
import { InvoiceReportFilter } from './components/InvoiceReportFilter'
import { InvoiceReportList } from './components/InvoiceReportList'
import { InvoiceReportGrouped } from './components/InvoiceReportGrouped'
import { ReportSummaryBar } from './components/ReportSummaryBar'
import { ReportLoadMore } from './components/ReportLoadMore'
import { ReportExportBar } from './components/ReportExportBar'
import { ReportSkeleton } from './components/ReportSkeleton'
import type {
  InvoiceReportType,
  InvoiceReportStatus,
  DateRangePreset,
  ReportGroupBy,
  ReportSortBy,
  ExportFormat,
} from './report.types'
import type { StatusFilterValue } from './components/InvoiceReportFilter'
import './report-shared.css'
import './report-cards.css'
import './report-shared-ui.css'
import { useLanguage } from '@/hooks/useLanguage'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvoiceReportPage() {
  const { t } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()

  const type: InvoiceReportType = location.pathname.includes('purchases')
    ? 'purchase'
    : 'sale'

  const title = type === 'sale' ? t.salesReport : t.purchaseReport

  const { data, status, filters, setFilter, loadMore, refresh } = useInvoiceReport({ type })

  // Active filter values for controlled pills
  const [activeDatePreset, setActiveDatePreset] = useState<DateRangePreset>('this_month')
  const [activeStatus, setActiveStatus] = useState<StatusFilterValue>('all')

  // Collapse state for grouped view — set of expanded group keys
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const handleDatePresetChange = useCallback(
    (value: string) => {
      const preset = value as DateRangePreset
      setActiveDatePreset(preset)
      if (preset !== 'custom') {
        const { from, to } = getDateRange(preset)
        setFilter('from', from)
        setFilter('to', to)
      }
    },
    [setFilter],
  )

  const handleStatusChange = useCallback(
    (value: string) => {
      const v = value as StatusFilterValue
      setActiveStatus(v)
      setFilter(
        'status',
        v === 'all' ? (undefined as unknown as InvoiceReportStatus) : v,
      )
    },
    [setFilter],
  )

  const handleGroupByChange = useCallback(
    (value: string) => {
      setFilter('groupBy', value as ReportGroupBy)
      setExpandedGroups(new Set())
    },
    [setFilter],
  )

  const handleSortByChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setFilter('sortBy', e.target.value as ReportSortBy)
    },
    [setFilter],
  )

  const handleToggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const handleInvoiceClick = useCallback(
    (id: string) => {
      navigate(ROUTES.INVOICE_DETAIL.replace(':id', id))
    },
    [navigate],
  )

  const handleExport = useCallback((_format: ExportFormat) => {
    // Export is handled by the service layer in a future implementation
  }, [])

  const isGrouped = filters.groupBy !== 'none'
  const hasData =
    data !== null &&
    (isGrouped
      ? (data.data.groups?.length ?? 0) > 0
      : (data.data.items?.length ?? 0) > 0)

  const summaryItems = data
    ? [
        { label: t.totalInvoices, value: String(data.data.summary.totalInvoices) },
        { label: t.totalAmount, value: formatAmount(data.data.summary.totalAmount), color: 'var(--color-primary-600)' },
        { label: t.paid, value: formatAmount(data.data.summary.totalPaid), color: 'var(--color-success-600)' },
        { label: t.outstanding, value: formatAmount(data.data.summary.totalOutstanding), color: 'var(--color-error-600)' },
      ]
    : []

  return (
    <AppShell>
      <Header title={title} backTo={ROUTES.REPORTS} />

      <PageContainer className="space-y-6">
        <InvoiceReportFilter
          activeDatePreset={activeDatePreset}
          activeStatus={activeStatus}
          activeGroupBy={filters.groupBy}
          activeSortBy={filters.sortBy}
          onDatePresetChange={handleDatePresetChange}
          onStatusChange={handleStatusChange}
          onGroupByChange={handleGroupByChange}
          onSortByChange={handleSortByChange}
        />

        {status === 'success' && data && <ReportSummaryBar items={summaryItems} />}
        {status === 'loading' && <ReportSkeleton rows={6} />}
        {status === 'error' && (
          <ErrorState
            title={`${t.couldNotLoadReport} ${title.toLowerCase()}`}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {status === 'success' && !hasData && (
          <div className="report-empty">
            <div className="report-empty-icon" aria-hidden="true">
              <FileText size={28} />
            </div>
            <p className="report-empty-title">{t.noInvoicesFound}</p>
            <p className="report-empty-desc">
              {t.tryAdjustingFilters}
            </p>
          </div>
        )}

        {status === 'success' && hasData && !isGrouped && (
          <InvoiceReportList
            items={data?.data.items ?? []}
            title={title}
            onInvoiceClick={handleInvoiceClick}
          />
        )}

        {status === 'success' && hasData && isGrouped && (
          <InvoiceReportGrouped
            groups={data?.data.groups ?? []}
            title={title}
            expandedGroups={expandedGroups}
            onToggleGroup={handleToggleGroup}
            onInvoiceClick={handleInvoiceClick}
          />
        )}

        {status === 'success' && (
          <ReportLoadMore
            hasMore={data?.meta.hasMore ?? false}
            isLoading={false}
            onLoadMore={loadMore}
          />
        )}

        {status === 'success' && hasData && (
          <ReportExportBar onExport={handleExport} disabled={false} />
        )}
      </PageContainer>
    </AppShell>
  )
}
