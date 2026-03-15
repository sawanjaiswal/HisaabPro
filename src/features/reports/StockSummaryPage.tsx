/** Stock Summary Page — current stock levels and values for all products (lazy loaded) */

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Search, X } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { useStockSummary } from './hooks/useStockSummary'
import { ReportSummaryBar } from './components/ReportSummaryBar'
import { ReportFilterPills } from './components/ReportFilterPills'
import { ReportLoadMore } from './components/ReportLoadMore'
import { ReportExportBar } from './components/ReportExportBar'
import { ReportSkeleton } from './components/ReportSkeleton'
import { ReportStatusBadge } from './components/ReportStatusBadge'
import {
  STOCK_STATUS_LABELS,
  STOCK_STATUS_COLORS,
  STOCK_SORT_LABELS,
} from './report.constants'
import { exportReport } from './report.service'
import { formatAmount } from './report.utils'
import type { ExportFormat, StockStatus, StockSortBy, StockSummaryItem } from './report.types'
import './reports.css'

// ─── Constants ─────────────────────────────────────────────────────────────────

const ALL_STOCK_STATUS = 'all'

type StockStatusFilter = StockStatus | typeof ALL_STOCK_STATUS

const STOCK_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: ALL_STOCK_STATUS, label: 'All' },
  { value: 'in_stock', label: STOCK_STATUS_LABELS.in_stock },
  { value: 'low', label: STOCK_STATUS_LABELS.low },
  { value: 'out_of_stock', label: STOCK_STATUS_LABELS.out_of_stock },
]

const STOCK_SORT_OPTIONS: Array<{ value: string; label: string }> = Object.entries(
  STOCK_SORT_LABELS,
).map(([value, label]) => ({ value, label }))

// ─── Product Card ──────────────────────────────────────────────────────────────

interface ProductCardProps {
  item: StockSummaryItem
}

function ProductCard({ item }: ProductCardProps) {
  return (
    <div className="report-card" role="listitem">
      <div className="report-card-header">
        <span className="report-card-number">{item.name}</span>
        <ReportStatusBadge
          status={item.stockStatus}
          label={STOCK_STATUS_LABELS[item.stockStatus]}
          color={STOCK_STATUS_COLORS[item.stockStatus]}
        />
      </div>
      <div className="report-card-body">
        <span className="report-card-party">{item.category}</span>
        <span className="report-card-items">
          {item.currentStock} {item.unit}
        </span>
      </div>
      <div className="report-card-footer">
        <span className="report-card-balance">
          Purchase: {formatAmount(item.stockValueAtPurchase)}
        </span>
        <span className="report-card-amount">
          Sale: {formatAmount(item.stockValueAtSale)}
        </span>
      </div>
      <div className="report-divider" />
    </div>
  )
}

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
        {/* Filter bar — sticky */}
        <div className="report-filter-bar">
          {/* Search input */}
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={16}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 'var(--space-3)',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-gray-400)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="search"
              className="input"
              placeholder="Search products..."
              defaultValue={filters.search ?? ''}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products by name"
              style={{ paddingLeft: 'var(--space-8)' }}
            />
          </div>

          {/* Stock status filter pills */}
          <ReportFilterPills
            options={STOCK_STATUS_OPTIONS}
            activeValue={activeStatusFilter}
            onChange={handleStatusChange}
            ariaLabel="Filter by stock status"
          />

          {/* Sort pills */}
          <ReportFilterPills
            options={STOCK_SORT_OPTIONS}
            activeValue={filters.sortBy}
            onChange={handleSortChange}
            ariaLabel="Sort products"
          />
        </div>

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
            {/* Summary bar */}
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

            {/* Empty — no products at all (no filters active) */}
            {items.length === 0 && !hasActiveFilters && (
              <div className="report-empty" role="status">
                <div className="report-empty-icon" aria-hidden="true">
                  <Package size={28} />
                </div>
                <p className="report-empty-title">No products yet</p>
                <p className="report-empty-desc">
                  No products added yet. Add your first product to track stock levels.
                </p>
                <button
                  className="btn btn-primary btn-md"
                  type="button"
                  onClick={() => navigate(ROUTES.PRODUCT_NEW)}
                  aria-label="Add a product"
                >
                  Add Product
                </button>
              </div>
            )}

            {/* Empty — filters yield nothing */}
            {items.length === 0 && hasActiveFilters && (
              <div className="report-empty" role="status">
                <div className="report-empty-icon" aria-hidden="true">
                  <Package size={28} />
                </div>
                <p className="report-empty-title">No products match your filters</p>
                <p className="report-empty-desc">
                  Try adjusting your search or filter to find what you are looking for.
                </p>
                <button
                  className="btn btn-secondary btn-md"
                  type="button"
                  onClick={handleClearFilters}
                  aria-label="Clear all filters"
                >
                  <X size={16} aria-hidden="true" />
                  Clear Filters
                </button>
              </div>
            )}

            {/* Product list */}
            {items.length > 0 && (
              <div
                className="report-card-list"
                role="list"
                aria-label="Stock summary"
              >
                {items.map((item) => (
                  <ProductCard key={item.productId} item={item} />
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
