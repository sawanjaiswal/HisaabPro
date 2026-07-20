/** Low Stock — Page (lazy loaded), mockup #49.
 *
 * Search → severity chips → product rows with a stock-vs-minimum fill bar →
 * Create Purchase Order. Expiry alerts (BAT-05) keep their own section above
 * the stock list. 4 UI states, 320px minimum.
 */

import { Search, Package } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { FilterChips, type FilterChipOption } from '@/components/ui/FilterChips'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useStockAlerts } from './useStockAlerts'
import { StockAlertRow } from './components/StockAlertRow'
import { ExpiryAlertCard } from './ExpiryAlertCard'
import type { StockAlertFilter } from './stock-alerts.types'
import './stock-alerts.css'

export default function StockAlertsPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const {
    alerts, totalCount, status, refetch,
    expiryAlerts, expiryStatus,
    search, setSearch, filter, setFilter,
    dismissingId, dismiss,
  } = useStockAlerts()

  const chips: FilterChipOption<StockAlertFilter>[] = [
    { value: 'ALL', label: t.all },
    { value: 'CRITICAL', label: t.criticalLabel },
    { value: 'LOW', label: t.lowLabel },
    { value: 'OUT_OF_STOCK', label: t.outOfStock },
  ]

  return (
    <AppShell>
      <Header title={t.lowStockTitle} backTo={ROUTES.PRODUCTS} />

      <PageContainer variant="list" className="space-y-6">
        <div className="search-bar">
          <Search size={18} aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchProductsShort}
            aria-label={t.searchProducts}
          />
        </div>

        <FilterChips
          options={chips}
          value={filter}
          onChange={setFilter}
          label={t.filterStockAlerts}
        />

        {/* Loading */}
        {status === 'pending' && (
          <div className="stock-alert-list" aria-busy="true">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="stock-alert-row">
                <Skeleton height="1.25rem" width="55%" />
                <Skeleton height="6px" width="100%" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadAlerts}
            message={t.checkConnectionRetry}
            onRetry={() => void refetch()}
          />
        )}

        {/* Expiry alerts (BAT-05) — separate concern, kept above the stock list */}
        {expiryStatus === 'success' && expiryAlerts.length > 0 && (
          <section className="space-y-3 py-0">
            <h2 className="stock-alert-heading">{t.expiryAlertsTitle}</h2>
            <div role="list" aria-label={t.expiryAlertsTitle} className="space-y-3">
              {expiryAlerts.map((alert) => (
                <ExpiryAlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          </section>
        )}

        {/* Empty — nothing is low at all, or nothing matches the chip/search */}
        {status === 'success' && alerts.length === 0 && (
          <EmptyState
            icon={<Package size={40} aria-hidden="true" />}
            title={totalCount === 0 ? t.stockAlertsEmpty : t.noResults}
            description={totalCount === 0 ? t.stockAlertsEmptyDesc : t.tryDifferentSearch}
          />
        )}

        {/* Success */}
        {status === 'success' && alerts.length > 0 && (
          <>
            <div role="status" aria-live="polite" className="sr-only">
              {alerts.length} {t.stockAlertsHeading}
            </div>
            <div className="stock-alert-list stagger-list" role="list" aria-label={t.lowStockTitle}>
              {alerts.map((alert) => (
                <StockAlertRow
                  key={alert.id}
                  alert={alert}
                  isDismissing={dismissingId === alert.id}
                  onOpen={(id) => navigate(ROUTES.PRODUCT_DETAIL.replace(':id', id))}
                  onDismiss={dismiss}
                />
              ))}
            </div>

            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => navigate(ROUTES.PURCHASE_NEW)}
            >
              {t.createPurchaseOrder}
            </Button>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
