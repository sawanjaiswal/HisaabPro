/** Profit & Loss Report Page
 *
 * Income vs expenses with net profit/loss.
 * Date range picker. 4 UI states.
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, BarChart3 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { formatPaise } from '@/lib/format'
import { getProfitLoss } from './finance.service'
import type { ProfitLossData, ProfitLossSection } from './finance.types'
import './report-finance.css'
import { useLanguage } from '@/hooks/useLanguage'
import { toLocalISODate } from '../../lib/format'

function SectionCard({ section, amountClass }: { section: ProfitLossSection; amountClass?: string }) {
  return (
    <div className="finance-section">
      <div className="finance-section__header">
        <span className="finance-section__title">{section.label}</span>
        <span className={`finance-section__total ${amountClass ?? ''}`}>{formatPaise(section.amount)}</span>
      </div>
      {section.items.length > 0 && (
        <div className="finance-section__rows">
          {section.items.map((item) => (
            <div key={item.label} className="finance-section__row">
              <span className="finance-section__row-label">{item.label}</span>
              <span className="finance-section__row-amount">{formatPaise(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function getMonthRange(): { from: string; to: string } {
  const now = new Date()
  const from = toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1))
  const to = toLocalISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  return { from, to }
}

export default function ProfitLossPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const [dateRange, setDateRange] = useState(getMonthRange)
  const [data, setData] = useState<ProfitLossData | null>(null)
  const [fetchStatus, setFetchStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setFetchStatus('loading')
    getProfitLoss(dateRange.from, dateRange.to, controller.signal)
      .then((d) => { setData(d); setFetchStatus('success') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchStatus('error')
        toast.error(err instanceof ApiError ? err.message : t.failedLoadPl)
      })
    return () => controller.abort()
  }, [dateRange, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  if (fetchStatus === 'loading') {
    return (
      <AppShell>
        <Header title={t.profitAndLoss} backTo={ROUTES.REPORTS} />
        <PageContainer>
          <div className="finance-skeleton" aria-busy="true">
            {['sk-1', 'sk-2', 'sk-3'].map((k) => <div key={k} className="finance-skeleton__section" />)}
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (fetchStatus === 'error') {
    return (
      <AppShell>
        <Header title={t.profitAndLoss} backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadPl} message={t.checkConnectionRetry} onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  const isProfit = (data?.netProfit ?? 0) >= 0

  return (
    <AppShell>
      <Header title={t.profitAndLoss} backTo={ROUTES.REPORTS} />
      <PageContainer>
        <div className="finance-date-bar fade-up">
          <span className="finance-date-bar__label">{t.from}</span>
          <input type="date" className="finance-date-bar__input" value={dateRange.from} onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))} aria-label={t.fromDate} />
          <span className="finance-date-bar__label">{t.to}</span>
          <input type="date" className="finance-date-bar__input" value={dateRange.to} onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))} aria-label={t.toDate} />
          <button type="button" className="finance-date-bar__refresh-btn" onClick={refresh} aria-label={t.refreshReport}>
            <RefreshCw size={14} aria-hidden="true" />
          </button>
        </div>

        {!data && (
          <div className="finance-empty">
            <div className="finance-empty__icon" aria-hidden="true"><BarChart3 size={32} /></div>
            <p className="finance-empty__title">{t.noDataForThisPeriod}</p>
            <p className="finance-empty__desc">{t.tryDifferentDateRange}</p>
          </div>
        )}

        {data && (
          <>
            <SectionCard section={data.revenue} />
            <SectionCard section={data.costOfGoods} />
            <div className={`finance-net-row${isProfit ? ' finance-net-row--profit' : ' finance-net-row--loss'}`}>
              <span className="finance-net-row__label">{t.grossProfit}</span>
              <span className="finance-net-row__amount">{formatPaise(data.grossProfit)}</span>
            </div>
            <SectionCard section={data.expenses} />
            {data.otherIncome.amount > 0 && <SectionCard section={data.otherIncome} />}
            <div className={`finance-net-row${isProfit ? ' finance-net-row--profit' : ' finance-net-row--loss'}`}>
              <span className="finance-net-row__label">{isProfit ? t.netProfitLabel : t.netLossLabel}</span>
              <span className="finance-net-row__amount">{formatPaise(Math.abs(data.netProfit))}</span>
            </div>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
