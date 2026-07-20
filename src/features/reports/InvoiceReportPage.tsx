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
import { HeroPage } from '@/components/layout/HeroPage'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ROUTES } from '@/config/routes.config'
import { getDateRange } from './report.utils'
import { useInvoiceReport } from './hooks/useInvoiceReport'
import { InvoiceReportFilter } from './components/InvoiceReportFilter'
import { InvoiceReportList } from './components/InvoiceReportList'
import { InvoiceReportGrouped } from './components/InvoiceReportGrouped'
import { InvoiceReportPeriod } from './components/InvoiceReportPeriod'
import { InvoiceReportHero } from './components/InvoiceReportHero'
import { InvoiceReportBreakup } from './components/InvoiceReportBreakup'
import { InvoiceReportSummaryGrid } from './components/InvoiceReportSummaryGrid'
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
import './report-invoice.css'
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
    (value: string) => {
      setFilter('sortBy', value as ReportSortBy)
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

  /** Bottom CTA — hands off to the full invoice list (sales or purchases). */
  const handleViewInvoices = useCallback(() => {
    navigate(type === 'sale' ? ROUTES.INVOICES : ROUTES.PURCHASES)
  }, [navigate, type])

  const handleExport = useCallback((_format: ExportFormat) => {
    // Export is handled by the service layer in a future implementation
  }, [])

  const isGrouped = filters.groupBy !== 'none'
  const hasData =
    data !== null &&
    (isGrouped
      ? (data.data.groups?.length ?? 0) > 0
      : (data.data.items?.length ?? 0) > 0)

  const hero = (
    <InvoiceReportPeriod
      activePreset={activeDatePreset}
      from={filters.from}
      to={filters.to}
      onPresetChange={handleDatePresetChange}
    />
  )

  return (
    <AppShell>
      <Header title={title} backTo={ROUTES.REPORTS} />

      <HeroPage hero={hero}>
        <PageContainer variant="list" className="space-y-6">
          {status === 'success' && data && (
            <>
              <InvoiceReportHero
                type={type}
                totalAmount={data.data.summary.totalAmount}
                trend={data.data.trend}
              />
              <InvoiceReportBreakup summary={data.data.summary} />
              <InvoiceReportSummaryGrid summary={data.data.summary} />
            </>
          )}

          {status === 'loading' && (
            <div className="invoice-report-hero-skeleton animate-pulse" aria-hidden="true" />
          )}

          <InvoiceReportFilter
            activeDatePreset={activeDatePreset}
            activeStatus={activeStatus}
            activeGroupBy={filters.groupBy}
            activeSortBy={filters.sortBy}
            onDatePresetChange={handleDatePresetChange}
            onStatusChange={handleStatusChange}
            onGroupByChange={handleGroupByChange}
            onSortByChange={handleSortByChange}
            hideDateRange
          />

          {status === 'loading' && <ReportSkeleton rows={6} />}
          {status === 'error' && (
            <ErrorState
              title={`${t.couldNotLoadReport} ${title.toLowerCase()}`}
              message={t.checkConnectionRetry}
              onRetry={refresh}
            />
          )}

          {status === 'success' && !hasData && (
            <EmptyState
              icon={<FileText size={22} aria-hidden="true" />}
              title={t.noInvoicesFound}
              description={t.tryAdjustingFilters}
            />
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

          {status === 'success' && hasData && (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleViewInvoices}
            >
              {t.viewInvoices}
            </Button>
          )}
          </PageContainer>
      </HeroPage>
    </AppShell>
  )
}
