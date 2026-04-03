/** TDS/TCS Report Page — GST Phase 2
 *
 * Shows a date-range and type filter (All / TDS / TCS), summary metric cards,
 * and a list of individual invoice entries with TDS/TCS breakdown.
 * All amounts in PAISE, converted for display via formatAmount().
 */

import { FileText } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useTdsTcs } from './hooks/useTdsTcs'
import { TdsTcsSummaryCards } from './components/TdsTcsSummaryCards'
import { TdsTcsEntryCard } from './components/TdsTcsEntryCard'
import { ReportFilterPills } from './components/ReportFilterPills'
import { ReportSkeleton } from './components/ReportSkeleton'
import './report-shared.css'
import './report-shared-ui.css'
import './report-tds-tcs.css'
import { useLanguage } from '@/hooks/useLanguage'

const TYPE_OPTIONS_BASE = [
  { value: 'all', labelKey: 'all' as const },
  { value: 'tds', labelKey: 'tds' as const },
  { value: 'tcs', labelKey: 'tcs' as const },
]

export default function TdsTcsReportPage() {
  const { t } = useLanguage()
  const { data, status, filters, setFilters, refresh } = useTdsTcs()

  // ─── Loading state ────────────────────────────────────────────────────────

  const typeOptions = TYPE_OPTIONS_BASE.map((opt) => ({
    value: opt.value,
    label: t[opt.labelKey],
  }))

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title={t.tdsTcsReport} backTo={ROUTES.REPORTS} />
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
        <Header title={t.tdsTcsReport} backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ErrorState
            title={t.couldNotLoadTdsTcs}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Success + Empty states ───────────────────────────────────────────────

  const entries = data?.entries ?? []
  const totals = data?.totals

  return (
    <AppShell>
      <Header title={t.tdsTcsReport} backTo={ROUTES.REPORTS} />

      <PageContainer>
        {/* Date range inputs */}
        <div className="tds-tcs-date-row">
          <input
            type="date"
            className="tds-tcs-date-input"
            value={filters.from}
            max={filters.to}
            aria-label={t.fromDate}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
          <input
            type="date"
            className="tds-tcs-date-input"
            value={filters.to}
            min={filters.from}
            aria-label={t.toDate}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </div>

        {/* Type filter pills */}
        <ReportFilterPills
          options={typeOptions}
          activeValue={filters.type}
          onChange={(value) =>
            setFilters({ ...filters, type: value as 'all' | 'tds' | 'tcs' })
          }
          ariaLabel={t.filterByTdsOrTcs}
        />

        {/* Summary cards */}
        {totals && <TdsTcsSummaryCards totals={totals} />}

        {/* Empty state */}
        {entries.length === 0 && (
          <div className="tds-tcs-empty">
            <div className="tds-tcs-empty__icon" aria-hidden="true">
              <FileText size={28} />
            </div>
            <p className="tds-tcs-empty__title">{t.noTdsTcsEntries}</p>
            <p className="tds-tcs-empty__desc">
              {t.noTdsTcsTransactions}
            </p>
          </div>
        )}

        {/* Entry list */}
        {entries.length > 0 && (
          <>
            <p className="tds-tcs-section-heading">
              {entries.length} {entries.length === 1 ? t.entry : t.entries}
            </p>
            <div className="tds-tcs-entry-list stagger-list">
              {entries.map((entry) => (
                <TdsTcsEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
