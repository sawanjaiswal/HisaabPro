/** Profit & Loss Report (mockup #16)
 *
 * Emerald hero carrying the period picker, then the Income / Expenses
 * statement and a Net Profit card with the vs-previous-period delta and the
 * per-day curve.
 *
 * The client type mirrors the server's return value exactly — the page used to
 * read keys the API never sent and crashed on load
 * (see .claude/fix-trace-pl-contract.md).
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { getDateRange } from './report.utils'
import { getProfitLoss } from './finance.service'
import { ReportPeriodSelect } from './components/ReportPeriodSelect'
import { ProfitLossStatement } from './components/ProfitLossStatement'
import { ProfitLossNetCard } from './components/ProfitLossNetCard'
import type { ProfitLossData } from './finance.types'
import type { DateRangePreset } from './report.types'
import './report-period.css'
import './report-profit-loss.css'

export default function ProfitLossPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const navigate = useNavigate()

  const [preset, setPreset] = useState<DateRangePreset>('this_month')
  const [range, setRange] = useState(() => getDateRange('this_month'))
  const [data, setData] = useState<ProfitLossData | null>(null)
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    getProfitLoss(range.from, range.to, controller.signal)
      .then((d) => {
        setData(d)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        toast.error(err instanceof ApiError ? err.message : t.failedLoadPl)
      })
    return () => controller.abort()
  }, [range, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const handlePresetChange = useCallback((value: string) => {
    const next = value as DateRangePreset
    setPreset(next)
    if (next !== 'custom') setRange(getDateRange(next))
  }, [])

  /** Bottom CTA — the day book is the line-by-line view behind these totals. */
  const handleViewFullReport = useCallback(() => {
    navigate(ROUTES.REPORT_DAY_BOOK)
  }, [navigate])

  const hasActivity =
    data !== null && (data.income.totalIncome !== 0 || data.expenses.totalExpenses !== 0)

  const hero = (
    <ReportPeriodSelect
      activePreset={preset}
      from={range.from}
      to={range.to}
      onPresetChange={handlePresetChange}
    />
  )

  return (
    <AppShell>
      <Header title={t.profitAndLoss} backTo={ROUTES.REPORTS} />

      <HeroPage hero={hero}>
        <PageContainer variant="list" className="space-y-6">
          {status === 'loading' && (
            <>
              <div className="pl-net-skeleton animate-pulse" aria-hidden="true" />
              <div className="pl-statement-skeleton animate-pulse" aria-busy="true" />
            </>
          )}

          {status === 'error' && (
            <ErrorState
              title={t.couldNotLoadPl}
              message={t.checkConnectionRetry}
              onRetry={refresh}
            />
          )}

          {status === 'success' && !hasActivity && (
            <EmptyState
              icon={<BarChart3 size={22} aria-hidden="true" />}
              title={t.noDataForThisPeriod}
              description={t.tryDifferentDateRange}
            />
          )}

          {status === 'success' && data && hasActivity && (
            <>
              <ProfitLossNetCard netProfit={data.netProfit} trend={data.trend} />
              <ProfitLossStatement data={data} />

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleViewFullReport}
              >
                {t.viewFullReport}
              </Button>
            </>
          )}
        </PageContainer>
      </HeroPage>
    </AppShell>
  )
}
