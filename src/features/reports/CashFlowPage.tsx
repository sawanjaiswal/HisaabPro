/** Cash Flow Report (mockup #69)
 *
 * Emerald hero carrying the period picker, then a direct-method statement:
 * cash in, cash out, the net movement, and the opening/closing cash it
 * reconciles to.
 *
 * The client type mirrors the server's return value exactly — the page used to
 * read keys the API never sent and crashed on load
 * (see .claude/fix-trace-pl-contract.md).
 */

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { getDateRange } from './report.utils'
import { getCashFlow } from './finance.service'
import { ReportPeriodSelect } from './components/ReportPeriodSelect'
import { CashFlowStatement } from './components/CashFlowStatement'
import type { CashFlowData } from './finance.types'
import type { DateRangePreset } from './report.types'
import './report-period.css'
import './report-cash-flow.css'

export default function CashFlowPage() {
  const { t } = useLanguage()
  const toast = useToast()

  const [preset, setPreset] = useState<DateRangePreset>('this_month')
  const [range, setRange] = useState(() => getDateRange('this_month'))
  const [data, setData] = useState<CashFlowData | null>(null)
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    getCashFlow(range.from, range.to, controller.signal)
      .then((d) => {
        setData(d)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        toast.error(err instanceof ApiError ? err.message : t.failedLoadCashFlow)
      })
    return () => controller.abort()
  }, [range, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const handlePresetChange = useCallback((value: string) => {
    const next = value as DateRangePreset
    setPreset(next)
    if (next !== 'custom') setRange(getDateRange(next))
  }, [])

  // Opening/closing cash exist even in a dead period, so "empty" means no cash
  // actually moved — not that the business holds none.
  const hasMovement = data !== null && (data.inflows.total !== 0 || data.outflows.total !== 0)

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
      <Header title={t.cashFlow} backTo={ROUTES.REPORTS} />

      <HeroPage hero={hero}>
        <PageContainer variant="list" className="space-y-6">
          {status === 'loading' && (
            <div className="cf-statement-skeleton animate-pulse" aria-busy="true" />
          )}

          {status === 'error' && (
            <ErrorState
              title={t.couldNotLoadCashFlow}
              message={t.checkConnectionRetry}
              onRetry={refresh}
            />
          )}

          {status === 'success' && !hasMovement && (
            <EmptyState
              icon={<TrendingUp size={22} aria-hidden="true" />}
              title={t.noDataForThisPeriod}
              description={t.tryDifferentDateRange}
            />
          )}

          {status === 'success' && data && hasMovement && (
            <>
              <CashFlowStatement data={data} />
              {data.partial && <p className="cf-partial-note">{t.partialPeriodTotals}</p>}
            </>
          )}
        </PageContainer>
      </HeroPage>
    </AppShell>
  )
}
