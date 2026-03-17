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

export default function TaxSummaryPage() {
  const { data, status, filters, setFilters, refresh } = useTaxSummary()

  const { summary, hsnSummary } = data

  // ─── Loading state ────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title="Tax Summary" backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ReportSkeleton rows={4} />
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Error state ──────────────────────────────────────────────────────────

  if (status === 'error') {
    return (
      <AppShell>
        <Header title="Tax Summary" backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ErrorState
            title="Could not load tax summary"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Success + Empty states ───────────────────────────────────────────────

  return (
    <AppShell>
      <Header title="Tax Summary" backTo={ROUTES.REPORTS} />

      <PageContainer>
        {/* Date range inputs */}
        <div className="tax-date-row">
          <input
            type="date"
            className="tax-date-input"
            value={filters.from}
            max={filters.to}
            aria-label="From date"
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
          <input
            type="date"
            className="tax-date-input"
            value={filters.to}
            min={filters.from}
            aria-label="To date"
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </div>

        {/* Empty state */}
        {!summary && (
          <div className="report-empty">
            <div className="report-empty-icon" aria-hidden="true">
              <Receipt size={28} />
            </div>
            <p className="report-empty-title">No tax data found</p>
            <p className="report-empty-desc">
              No taxable transactions were found for this date range.
            </p>
          </div>
        )}

        {/* Success */}
        {summary && (
          <>
            {/* Net Tax Liability highlight */}
            <div className="tax-net-liability">
              <span className="tax-net-liability__label">Net Tax Liability</span>
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
