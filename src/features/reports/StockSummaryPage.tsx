/** Stock Summary Page — current stock levels and values for all products (lazy loaded) */

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { useStockSummary } from './hooks/useStockSummary'
import { ReportSummaryBar } from './components/ReportSummaryBar'
import { ReportLoadMore } from './components/ReportLoadMore'
import { ReportExportBar } from './components/ReportExportBar'
import { ReportSkeleton } from './components/ReportSkeleton'
import { StockSummaryFilterBar } from './components/StockSummaryFilterBar'
import { StockSummaryProductCard } from './components/StockSummaryProductCard'
import { StockSummaryEmpty } from './components/StockSummaryEmpty'
import { exportReport } from './report.service'
import { formatAmount } from './report.utils'
import type { ExportFormat, StockStatus, StockSortBy } from './report.types'
import type { StockStatusFilter } from './components/StockSummaryFilterBar'
import './report-shared.css'
import './report-cards.css'
import './report-shared-ui.css'

// ─── Constants ─────────────────────────────────────────────────────────────────

const ALL_STOCK_STATUS = 'all'

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function StockSummaryPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const { data, status, filters, setFilter, setSearch, loadMore, refresh } =
    useStockSummary()

  const summary = data?.data.summary
  const items = data?.data.items ?? []
  const hasMore = data?.meta.hasMore ?? false

  const activeStatusFilter: StockStatusFilter = filters.stockStatus ?? ALL_STOCK_STATUS
  const hasActiveFilters =
    filters.stockStatus !== undefined || (filters.search !== undefined && filters.search !== '')

  const handleStatusChange = useCallback(
    (value: string) => {
      if (value === ALL_STOCK_STATUS) {
        setFilter('stockStatus', undefined)
      } else {
        setFilter('stockStatus', value as StockStatus)
      }
    },
    [setFilter],
  )

  const handleSortChange = useCallback(
    (value: string) => {
      setFilter('sortBy', value as StockSortBy)
    },
    [setFilter],
  )

  const handleClearFilters = useCallback(() => {
    setFilter('stockStatus', undefined)
    setSearch('')
  }, [setFilter, setSearch])

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!data) return
      try {
        await exportReport({
          reportType: 'stock_summary',
          format,
          filters: filters as unknown as Record<string, unknown>,
        })
        toast.success(`Stock summary exported as ${format.toUpperCase()}`)
      } catch {
        toast.error('Export failed. Please try again.')
      }
    },
    [data, filters, toast],
  )

  return (
    <AppShell>
      <Header title="Stock Summary" backTo={ROUTES.REPORTS} />

      <PageContainer>
        <StockSummaryFilterBar
          searchDefault={filters.search ?? ''}
          activeStatusFilter={activeStatusFilter}
          activeSortBy={filters.sortBy}
          onSearchChange={setSearch}
          onStatusChange={handleStatusChange}
          onSortChange={handleSortChange}
        />

        {/* Loading */}
        {status === 'loading' && <ReportSkeleton rows={6} />}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title="Could not load stock"
            message="Failed to fetch stock summary. Please try again."
            onRetry={refresh}
          />
        )}

        {/* Success */}
        {status === 'success' && summary && (
          <>
            <ReportSummaryBar
              items={[
                {
                  label: 'Products',
                  value: String(summary.totalProducts),
                },
                {
                  label: 'Stock Value (Buy)',
                  value: formatAmount(summary.totalStockValueAtPurchase),
                },
                {
                  label: 'Stock Value (Sale)',
                  value: formatAmount(summary.totalStockValueAtSale),
                },
                {
                  label: 'Low Stock',
                  value: String(summary.lowStockCount),
                  color:
                    summary.lowStockCount > 0
                      ? 'var(--color-warning-600)'
                      : undefined,
                },
                {
                  label: 'Out of Stock',
                  value: String(summary.outOfStockCount),
                  color:
                    summary.outOfStockCount > 0
                      ? 'var(--color-error-600)'
                      : undefined,
                },
              ]}
            />

            {/* Empty states */}
            {items.length === 0 && (
              <StockSummaryEmpty
                hasActiveFilters={hasActiveFilters}
                onNavigateNew={() => navigate(ROUTES.PRODUCT_NEW)}
                onClearFilters={handleClearFilters}
              />
            )}

            {/* Product list */}
            {items.length > 0 && (
              <div
                className="report-card-list"
                role="list"
                aria-label="Stock summary"
              >
                {items.map((item) => (
                  <StockSummaryProductCard key={item.productId} item={item} />
                ))}
              </div>
            )}

            <ReportLoadMore
              hasMore={hasMore}
              isLoading={false}
              onLoadMore={loadMore}
            />

            <ReportExportBar onExport={handleExport} disabled={items.length === 0} />
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
