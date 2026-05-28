/** Predictive Analytics (#146) — revenue projection + stock-out forecast.
 *
 * Deterministic: revenue is an OLS linear trend over recent months, stock-out
 * is sales-velocity ÷ current stock. Every number is explainable — no opaque
 * model. 4 UI states. */

import { LineChart } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useRevenueForecast } from './hooks/useRevenueForecast'
import { useStockForecast } from './hooks/useStockForecast'
import { RevenueForecastCard } from './components/RevenueForecastCard'
import { StockForecastList } from './components/StockForecastList'
import './analytics.css'

export default function PredictiveAnalyticsPage() {
  const { t } = useLanguage()
  const revenue = useRevenueForecast()
  const stock = useStockForecast()

  const isLoading = revenue.isLoading || stock.isLoading
  const isError = revenue.isError || stock.isError

  const hasRevenue =
    !!revenue.data && revenue.data.points.some((p) => p.revenuePaise > 0)
  const hasStock = !!stock.data && stock.data.items.length > 0
  const isEmpty = !isLoading && !isError && !hasRevenue && !hasStock

  const retry = () => {
    revenue.refetch()
    stock.refetch()
  }

  return (
    <AppShell>
      <Header title={t.insights} backTo={ROUTES.MORE} />
      <PageContainer variant="list" className="space-y-6">
        {isLoading && (
          <div className="space-y-6" aria-busy="true">
            <Skeleton height="220px" borderRadius="var(--radius-xl)" />
            <Skeleton height="260px" borderRadius="var(--radius-xl)" />
          </div>
        )}

        {!isLoading && isError && (
          <ErrorState
            title={t.couldNotLoadInsights}
            message={t.checkConnectionRetry}
            onRetry={retry}
          />
        )}

        {isEmpty && (
          <EmptyState
            icon={<LineChart size={32} aria-hidden="true" />}
            title={t.insightsEmptyTitle}
            description={t.insightsEmptyDesc}
          />
        )}

        {!isLoading && !isError && !isEmpty && (
          <>
            {revenue.data && hasRevenue && (
              <RevenueForecastCard forecast={revenue.data} />
            )}
            {stock.data && hasStock && <StockForecastList items={stock.data.items} />}
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
