/** Product Detail — Overview tab (GPT reskin): analytics metric grid +
 *  stock-summary breakdown + recent-activity list. All numbers are real,
 *  sourced from the /products/:id/analytics endpoint. */

import { CircleDollarSign, ShoppingBag, TrendingUp } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import type { ProductDetail } from '../product.types'
import type { ProductAnalytics } from '../product-analytics.types'
import { formatProductPrice } from '../product.utils'
import { ProductMetricCard } from './ProductMetricCard'
import { ProductStockSummaryCard } from './ProductStockSummaryCard'
import { ProductRecentActivity } from './ProductRecentActivity'

interface ProductOverviewTabProps {
  product: ProductDetail
  analytics: ProductAnalytics | null
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  onAdjust: () => void
  onViewStock: () => void
  onViewActivity: () => void
}

export function ProductOverviewTab({
  product,
  analytics,
  isLoading,
  isError,
  onRetry,
  onAdjust,
  onViewStock,
  onViewActivity,
}: ProductOverviewTabProps) {
  const { t } = useLanguage()
  const unit = product.unit.symbol

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="pd-metric-grid">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height="6.5rem" borderRadius="var(--radius-xl)" />
          ))}
        </div>
        <Skeleton height="18rem" borderRadius="var(--radius-xl)" />
      </div>
    )
  }

  if (isError || !analytics) {
    return <ErrorState title={t.couldNotLoadProduct} message={t.checkConnectionRetry} onRetry={onRetry} />
  }

  const m = analytics.salesMetrics

  return (
    <div className="space-y-6">
      <section className="pd-overview" aria-label={t.productOverview}>
        <h3 className="pd-overview__title">{t.productOverview}</h3>
        <div className="pd-metric-grid">
          <ProductMetricCard
            tone="sales"
            icon={<CircleDollarSign size={18} />}
            label={t.salesValue}
            value={formatProductPrice(m.salesValue)}
            sub={t.thisMonth}
            spark={m.spark.salesValue}
            sparkColor="var(--color-success-500)"
          />
          <ProductMetricCard
            tone="units"
            icon={<ShoppingBag size={18} />}
            label={t.unitsSold}
            value={`${m.unitsSold} ${unit}`}
            sub={t.thisMonth}
            spark={m.spark.unitsSold}
            sparkColor="var(--color-info-500)"
          />
          <ProductMetricCard
            tone="profit"
            icon={<TrendingUp size={18} />}
            label={t.profitMetric}
            value={formatProductPrice(m.profit)}
            sub={t.thisMonth}
            spark={m.spark.profit}
            sparkColor="var(--color-success-600)"
          />
          <ProductMetricCard
            tone="price"
            icon={<CircleDollarSign size={18} />}
            label={t.avgSellingPrice}
            value={formatProductPrice(m.avgSellingPrice)}
            sub={t.thisMonth}
            spark={m.spark.avgSellingPrice}
            sparkColor="var(--color-warning-500)"
          />
        </div>
      </section>

      <ProductStockSummaryCard
        summary={analytics.stockSummary}
        unitLabel={unit}
        onAdjust={onAdjust}
        onViewAll={onViewStock}
      />

      <ProductRecentActivity
        movements={product.recentMovements}
        unitLabel={unit}
        onViewAll={onViewActivity}
      />
    </div>
  )
}
