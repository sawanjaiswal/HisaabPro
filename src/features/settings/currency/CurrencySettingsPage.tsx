/** Currency Settings Page
 *
 * Lists exchange rates (paginated) and lets users set new rates via a Drawer.
 * 4 UI states: loading → error → empty → success.
 */

import { useState } from 'react'
import { DollarSign } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Drawer } from '@/components/ui/Drawer'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useCurrencySettings } from './useCurrencySettings'
import { CurrencyRateCard } from './components/CurrencyRateCard'
import { SetRateForm } from './components/SetRateForm'
import { CurrencyRatesSkeleton } from './components/CurrencyRatesSkeleton'
import './currency-settings.css'

export default function CurrencySettingsPage() {
  const { t } = useLanguage()
  const { currencies, rates, status, page, hasMore, setPage, setRate, refresh } =
    useCurrencySettings()

  const [drawerOpen, setDrawerOpen] = useState(false)

  function handleSetRate(payload: Parameters<typeof setRate>[0]) {
    return setRate(payload).then(() => {
      setDrawerOpen(false)
    })
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title={t.exchangeRates} backTo={ROUTES.SETTINGS} />
        <PageContainer>
          <CurrencyRatesSkeleton />
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Error ────────────────────────────────────────────────────────────────

  if (status === 'error') {
    return (
      <AppShell>
        <Header title={t.exchangeRates} backTo={ROUTES.SETTINGS} />
        <PageContainer>
          <ErrorState
            title={t.couldNotLoadExchangeRates}
            message={t.checkConnectionRetry2}
            onRetry={refresh}
          />
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Success + Empty ──────────────────────────────────────────────────────

  return (
    <AppShell>
      <Header
        title={t.exchangeRates}
        backTo={ROUTES.SETTINGS}
        actions={
          <button
            type="button"
            className="currency-header-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label={t.setExchangeRateAria}
          >
            {t.setRateLabel}
          </button>
        }
      />

      <PageContainer>
        {rates.length === 0 ? (
          <div className="currency-empty">
            <div className="currency-empty__icon" aria-hidden="true">
              <DollarSign size={32} />
            </div>
            <p className="currency-empty__title">{t.noExchangeRates}</p>
            <p className="currency-empty__desc">
              {t.exchangeRatesEmptyDesc}
            </p>
            <button
              type="button"
              className="currency-empty__cta"
              onClick={() => setDrawerOpen(true)}
            >
              {t.setFirstRate}
            </button>
          </div>
        ) : (
          <>
            <p className="currency-section-label py-0">
              {rates.length} {rates.length === 1 ? t.rateWord : t.ratesWord} {t.configuredSuffix}
            </p>

            <div className="currency-rate-list stagger-list">
              {rates.map((entry) => (
                <CurrencyRateCard key={entry.id} entry={entry} />
              ))}
            </div>

            {(hasMore || page > 1) && (
              <div className="currency-pagination">
                <button
                  type="button"
                  className="currency-pagination__btn"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  aria-label={t.previousPage}
                >
                  {t.previous}
                </button>
                <span className="currency-pagination__info">{t.pageLabel} {page}</span>
                <button
                  type="button"
                  className="currency-pagination__btn"
                  disabled={!hasMore}
                  onClick={() => setPage(page + 1)}
                  aria-label={t.nextPage}
                >
                  {t.next}
                </button>
              </div>
            )}
          </>
        )}
      </PageContainer>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={t.setExchangeRate}
        size="sm"
      >
        <SetRateForm
          currencies={currencies}
          onSubmit={handleSetRate}
          onCancel={() => setDrawerOpen(false)}
        />
      </Drawer>
    </AppShell>
  )
}
