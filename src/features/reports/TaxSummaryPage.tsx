/** Tax Summary Page — GST tax breakdown for a date range (lazy loaded) */

import { Receipt } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useTaxSummary } from './hooks/useTaxSummary'
import { TaxSummaryCards } from './components/TaxSummaryCards'
import { HsnSummaryTable } from './components/HsnSummaryTable'
import { ReportSkeleton } from './components/ReportSkeleton'
import { formatAmount } from './report.utils'
import './report-shared.css'
import './report-shared-ui.css'
import './report-tax.css'
import { useLanguage } from '@/hooks/useLanguage'

export default function TaxSummaryPage() {
  const { t } = useLanguage()
  const { data, status, filters, setFilters, refresh } = useTaxSummary()

  const { summary, hsnSummary } = data

  // ─── Loading state ────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title={t.taxSummary} backTo={ROUTES.REPORTS} />
        <PageContainer className="space-y-6">
          <ReportSkeleton rows={4} />
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Error state ──────────────────────────────────────────────────────────

  if (status === 'error') {
    return (
      <AppShell>
        <Header title={t.taxSummary} backTo={ROUTES.REPORTS} />
        <PageContainer className="space-y-6">
          <ErrorState
            title={t.couldNotLoadTaxSummary}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Success + Empty states ───────────────────────────────────────────────

  return (
    <AppShell>
      <Header title={t.taxSummary} backTo={ROUTES.REPORTS} />

      <PageContainer className="space-y-6">
        {/* Date range inputs */}
        <div className="tax-date-row fade-up">
          <input
            type="date"
            className="tax-date-input"
            value={filters.from}
            max={filters.to}
            aria-label={t.fromDate}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
          <input
            type="date"
            className="tax-date-input"
            value={filters.to}
            min={filters.from}
            aria-label={t.toDate}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </div>

        {/* Empty state */}
        {!summary && (
          <div className="report-empty">
            <div className="report-empty-icon" aria-hidden="true">
              <Receipt size={28} />
            </div>
            <p className="report-empty-title">{t.noTaxDataFound}</p>
            <p className="report-empty-desc">
              {t.noTaxableTransactions}
            </p>
          </div>
        )}

        {/* Success */}
        {summary && (
          <>
            {/* Net Tax Liability highlight */}
            <div className="tax-net-liability">
              <span className="tax-net-liability__label">{t.netTaxLiability}</span>
              <span className="tax-net-liability__value">
                {formatAmount(summary.netTaxLiability)}
              </span>
            </div>

            {/* Category-wise tax cards */}
            <TaxSummaryCards summary={summary} />

            {/* HSN summary */}
            {hsnSummary && hsnSummary.items.length > 0 && (
              <HsnSummaryTable items={hsnSummary.items} />
            )}
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
