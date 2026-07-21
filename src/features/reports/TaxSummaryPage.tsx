/** Tax Summary Page — GST tax breakdown for a date range (mockup #31, lazy loaded)
 *
 * Emerald hero carries the period picker; the sheet below leads with the
 * taxable sales/purchase totals and the net liability, then keeps the
 * category cards and the HSN table that the old page already shipped.
 */

import { useState } from 'react'
import { Receipt } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useTaxSummary } from './hooks/useTaxSummary'
import { TaxSummaryCards } from './components/TaxSummaryCards'
import { TaxTotalsCard } from './components/TaxTotalsCard'
import { TaxNetLiabilityCard } from './components/TaxNetLiabilityCard'
import { HsnSummaryTable } from './components/HsnSummaryTable'
import { ReportPeriodSelect } from './components/ReportPeriodSelect'
import { ReportSkeleton } from './components/ReportSkeleton'
import { getDateRange } from './report.utils'
import type { DateRangePreset } from './report.types'
import './report-shared.css'
import './report-shared-ui.css'
import './report-period.css'
import './report-tax.css'

export default function TaxSummaryPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { data, status, filters, setFilters, refresh } = useTaxSummary()

  // The hook owns the resolved dates; the preset is presentation state, so the
  // picker can show "This FY" instead of re-deriving it from two ISO strings.
  const [preset, setPreset] = useState<DateRangePreset>('this_fy')

  const { summary, hsnSummary } = data

  const handlePresetChange = (value: string) => {
    const next = value as DateRangePreset
    setPreset(next)
    if (next !== 'custom') setFilters(getDateRange(next))
  }

  const hero = (
    <ReportPeriodSelect
      activePreset={preset}
      from={filters.from}
      to={filters.to}
      onPresetChange={handlePresetChange}
      onRangeChange={(range) => setFilters(range)}
    />
  )

  // ─── Loading state ────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title={t.taxSummary} backTo={ROUTES.REPORTS} />
        <HeroPage hero={hero}>
          <PageContainer variant="list" className="space-y-6">
            <ReportSkeleton rows={4} />
          </PageContainer>
        </HeroPage>
      </AppShell>
    )
  }

  // ─── Error state ──────────────────────────────────────────────────────────

  if (status === 'error') {
    return (
      <AppShell>
        <Header title={t.taxSummary} backTo={ROUTES.REPORTS} />
        <HeroPage hero={hero}>
          <PageContainer variant="list" className="space-y-6">
            <ErrorState
              title={t.couldNotLoadTaxSummary}
              message={t.checkConnectionRetry}
              onRetry={refresh}
            />
          </PageContainer>
        </HeroPage>
      </AppShell>
    )
  }

  // ─── Success + Empty states ───────────────────────────────────────────────

  return (
    <AppShell>
      <Header title={t.taxSummary} backTo={ROUTES.REPORTS} />

      <HeroPage hero={hero}>
        <PageContainer variant="list" className="space-y-6">
          {!summary && (
            <EmptyState
              icon={<Receipt size={22} aria-hidden="true" />}
              title={t.noTaxDataFound}
              description={t.noTaxableTransactions}
            />
          )}

          {summary && (
            <>
              <TaxTotalsCard
                title={t.taxableSales}
                totals={summary.sales}
                countLabel={`${summary.sales.count} ${t.invoices}`}
              />

              <TaxTotalsCard
                title={t.taxablePurchases}
                totals={summary.purchases}
                countLabel={`${summary.purchases.count} ${t.invoices}`}
              />

              <TaxNetLiabilityCard liability={summary.netTaxLiability} />

              {/* Category split — sales / ITC / credit + debit notes */}
              <TaxSummaryCards summary={summary} />

              {hsnSummary && hsnSummary.items.length > 0 && (
                <HsnSummaryTable items={hsnSummary.items} />
              )}

              <Button
                variant="outline"
                className="tax-summary-cta"
                onClick={() => navigate(ROUTES.REPORT_GST_RETURNS)}
              >
                {t.viewDetailedReport}
              </Button>
            </>
          )}
        </PageContainer>
      </HeroPage>
    </AppShell>
  )
}
