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
import { useCurrencySettings } from './useCurrencySettings'
import { CurrencyRateCard } from './components/CurrencyRateCard'
import { SetRateForm } from './components/SetRateForm'
import { CurrencyRatesSkeleton } from './components/CurrencyRatesSkeleton'
import './currency-settings.css'

export default function CurrencySettingsPage() {
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
        <Header title="Exchange Rates" backTo={ROUTES.SETTINGS} />
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
        <Header title="Exchange Rates" backTo={ROUTES.SETTINGS} />
        <PageContainer>
          <ErrorState
            title="Could not load exchange rates"
            message="Check your connection and try again."
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
        title="Exchange Rates"
        backTo={ROUTES.SETTINGS}
        actions={
          <button
            type="button"
            className="currency-header-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Set exchange rate"
          >
            Set Rate
          </button>
        }
      />

      <PageContainer>
        {rates.length === 0 ? (
          <div className="currency-empty">
            <div className="currency-empty__icon" aria-hidden="true">
              <DollarSign size={32} />
            </div>
            <p className="currency-empty__title">No exchange rates set</p>
            <p className="currency-empty__desc">
              Set rates for foreign currencies to enable multi-currency billing.
            </p>
            <button
              type="button"
              className="currency-empty__cta"
              onClick={() => setDrawerOpen(true)}
            >
              Set Your First Rate
            </button>
          </div>
        ) : (
          <>
            <p className="currency-section-label">
              {rates.length} {rates.length === 1 ? 'rate' : 'rates'} configured
            </p>

            <div className="currency-rate-list">
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
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <span className="currency-pagination__info">Page {page}</span>
                <button
                  type="button"
                  className="currency-pagination__btn"
                  disabled={!hasMore}
                  onClick={() => setPage(page + 1)}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </PageContainer>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Set Exchange Rate"
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
