/** Stock Value Report Page — total inventory value at weighted-avg cost with CSV export */

import { useCallback } from 'react'
import { Download, TrendingUp } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ROUTES } from '@/config/routes.config'
import { formatCurrency } from '@/lib/format'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { useStockValueReport } from './hooks/useStockValueReport'
import type { StockValueItem } from './hooks/useStockValueReport'
import './stock-value-report.css'

// ─── CSV export ────────────────────────────────────────────────────────────────

function buildCsv(items: StockValueItem[]): string {
  const headers = ['SKU', 'Product', 'Stock', 'Unit', 'Avg Cost (Rs)', 'Value (Rs)']
  const rows = items.map((item) => [
    item.sku ?? '',
    item.name,
    String(item.currentStock),
    item.unit ?? 'pcs',
    (Number(item.weightedAvgCostPaise) / 100).toFixed(2),
    (Number(item.lineValuePaise) / 100).toFixed(2),
  ])
  return [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// ─── Row component ─────────────────────────────────────────────────────────────

function StockValueRow({ item }: { item: StockValueItem }) {
  const unit = item.unit ?? 'pcs'
  const avgCost = Number(item.weightedAvgCostPaise)
  const lineValue = Number(item.lineValuePaise)

  return (
    <div className="svr-row" role="row">
      <div className="svr-row__main">
        <span className="svr-row__name">{item.name}</span>
        {item.sku && <span className="svr-row__sku">{item.sku}</span>}
      </div>
      <div className="svr-row__numbers">
        <span className="svr-row__stock">{item.currentStock} {unit}</span>
        <span className="svr-row__avg">{formatCurrency(avgCost)}</span>
        <span className="svr-row__value">{formatCurrency(lineValue)}</span>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function StockValueReportPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const { items, summary, hasMore, status, error, loadMore, refresh, isFetchingMore } =
    useStockValueReport()

  const handleExport = useCallback(() => {
    if (items.length === 0) return
    const csv = buildCsv(items)
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(csv, `stock-value-${date}.csv`)
    toast.success(t.csvExportToast)
  }, [items, toast, t])

  const totalValue = summary ? Number(summary.totalValuePaise) : 0
  const productCount = summary?.productCount ?? 0

  return (
    <AppShell>
      <Header
        title={t.stockValueReportTitle}
        backTo={ROUTES.REPORTS}
        actions={
          status === 'success' && items.length > 0 ? (
            <button
              type="button"
              className="svr-export-btn"
              onClick={handleExport}
              aria-label={t.exportCsvLabel}
            >
              <Download size={16} aria-hidden="true" />
              {t.exportCsvLabel}
            </button>
          ) : undefined
        }
      />

      {/* Summary strip */}
      {status === 'success' && (
        <div className="svr-summary" aria-label={t.totalStockValueLabel}>
          <div className="svr-summary__item">
            <span className="svr-summary__label">{t.totalStockValueLabel}</span>
            <span className="svr-summary__value svr-summary__value--primary">
              {formatCurrency(totalValue)}
            </span>
          </div>
          <div className="svr-summary__divider" aria-hidden="true" />
          <div className="svr-summary__item">
            <span className="svr-summary__label">{t.productCountLabel}</span>
            <span className="svr-summary__value">{productCount}</span>
          </div>
        </div>
      )}

      <PageContainer>
        {status === 'loading' && (
          <div aria-busy="true" className="svr-skeleton">
            <Skeleton height="1.5rem" width="50%" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height="4rem" borderRadius="var(--radius-md)" />
            ))}
          </div>
        )}

        {status === 'error' && (
          <ErrorState title={t.couldNotLoadStockValue} message={error?.message} onRetry={refresh} />
        )}

        {status === 'success' && items.length === 0 && (
          <EmptyState
            icon={<TrendingUp size={28} aria-hidden="true" />}
            title={t.stockValueReportEmpty}
            description={t.stockValueReportEmptyDesc}
          />
        )}

        {status === 'success' && items.length > 0 && (
          <>
            {/* Column headers */}
            <div className="svr-header-row" role="row" aria-hidden="true">
              <span className="svr-header-row__product">{t.alertProduct}</span>
              <span className="svr-header-row__stock">{t.alertCurrentStock}</span>
              <span className="svr-header-row__avg">{t.avgCostLabel}</span>
              <span className="svr-header-row__value">{t.stockValueLabel}</span>
            </div>

            <div className="svr-list stagger-list" role="table" aria-label={t.stockValueReportTitle}>
              {items.map((item) => (
                <StockValueRow key={item.productId} item={item} />
              ))}
            </div>

            {hasMore && (
              <button
                type="button"
                className="svr-load-more"
                onClick={loadMore}
                disabled={isFetchingMore}
                aria-busy={isFetchingMore}
              >
                {isFetchingMore ? '...' : t.loadMoreProducts}
              </button>
            )}
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
