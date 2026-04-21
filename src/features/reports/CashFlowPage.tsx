/** Cash Flow Statement Page
 *
 * Operating / Investing / Financing sections.
 * Date range picker. 4 UI states.
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { formatPaise } from '@/lib/format'
import { getCashFlow } from './finance.service'
import type { CashFlowData, CashFlowSection } from './finance.types'
import './report-finance.css'
import { useLanguage } from '@/hooks/useLanguage'
import { toLocalISODate } from '../../lib/format'

function CashFlowSectionCard({ section }: { section: CashFlowSection }) {
  const isPositive = section.netAmount >= 0
  return (
    <div className="finance-section py-0">
      <div className="finance-section__header py-0">
        <span className="finance-section__title py-0">{section.label}</span>
        <span className={`finance-section__total ${isPositive ? 'finance-section__total--profit' : 'finance-section__total--loss'}`}>
          {formatPaise(section.netAmount)}
        </span>
      </div>
      {section.items.length > 0 && (
        <div className="finance-section__rows py-0">
          {section.items.map((item) => (
            <div key={item.label} className="finance-section__row py-0">
              <span className="finance-section__row-label py-0">{item.label}</span>
              <span className="finance-section__row-amount py-0">{formatPaise(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function getMonthRange() {
  const now = new Date()
  return {
    from: toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toLocalISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

export default function CashFlowPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const [dateRange, setDateRange] = useState(getMonthRange)
  const [data, setData] = useState<CashFlowData | null>(null)
  const [fetchStatus, setFetchStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setFetchStatus('loading')
    getCashFlow(dateRange.from, dateRange.to, controller.signal)
      .then((d) => { setData(d); setFetchStatus('success') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchStatus('error')
        toast.error(err instanceof ApiError ? err.message : t.failedLoadCashFlow)
      })
    return () => controller.abort()
  }, [dateRange, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  if (fetchStatus === 'loading') {
    return (
      <AppShell>
        <Header title={t.cashFlow} backTo={ROUTES.REPORTS} />
        <PageContainer>
          <div className="finance-skeleton" aria-busy="true">
            {['sk-1', 'sk-2', 'sk-3'].map((k) => <div key={k} className="finance-skeleton__section py-0" />)}
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (fetchStatus === 'error') {
    return (
      <AppShell>
        <Header title={t.cashFlow} backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadCashFlow} message={t.checkConnectionRetry} onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  const isPositiveNet = (data?.netCashFlow ?? 0) >= 0

  return (
    <AppShell>
      <Header title={t.cashFlowStatement} backTo={ROUTES.REPORTS} />
      <PageContainer>
        <div className="finance-date-bar fade-up">
          <span className="finance-date-bar__label">{t.from}</span>
          <input type="date" className="finance-date-bar__input" value={dateRange.from} onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))} aria-label={t.fromDate} />
          <span className="finance-date-bar__label">{t.to}</span>
          <input type="date" className="finance-date-bar__input" value={dateRange.to} onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))} aria-label={t.toDate} />
          <button type="button" className="finance-date-bar__refresh-btn" onClick={refresh} aria-label={t.refreshCashFlow}>
            <RefreshCw size={14} aria-hidden="true" />
          </button>
        </div>

        {!data && (
          <div className="finance-empty">
            <div className="finance-empty__icon" aria-hidden="true"><TrendingUp size={32} /></div>
            <p className="finance-empty__title">{t.noDataForThisPeriod}</p>
            <p className="finance-empty__desc">{t.tryDifferentDateRange}</p>
          </div>
        )}

        {data && (
          <>
            <CashFlowSectionCard section={data.operating} />
            <CashFlowSectionCard section={data.investing} />
            <CashFlowSectionCard section={data.financing} />
            <div className={`finance-net-row${isPositiveNet ? ' finance-net-row--profit' : ' finance-net-row--loss'}`}>
              <span className="finance-net-row__label">{t.netCashFlow}</span>
              <span className="finance-net-row__amount">{formatPaise(data.netCashFlow)}</span>
            </div>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
