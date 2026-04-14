/** Balance Sheet Report Page
 *
 * Assets / Liabilities / Equity sections with as-of date.
 * 4 UI states.
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
import { getBalanceSheet } from './finance.service'
import type { BalanceSheetData, BalanceSheetSection } from './finance.types'
import './report-finance.css'
import { useLanguage } from '@/hooks/useLanguage'
import { toLocalISODate } from '../../lib/format'

function SectionCard({ section }: { section: BalanceSheetSection }) {
  return (
    <div className="finance-section">
      <div className="finance-section__header">
        <span className="finance-section__title">{section.label}</span>
        <span className="finance-section__total">{formatPaise(section.total)}</span>
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

export default function BalanceSheetPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const [asOf, setAsOf] = useState(() => toLocalISODate(new Date()))
  const [data, setData] = useState<BalanceSheetData | null>(null)
  const [fetchStatus, setFetchStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setFetchStatus('loading')
    getBalanceSheet(asOf, controller.signal)
      .then((d) => { setData(d); setFetchStatus('success') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchStatus('error')
        toast.error(err instanceof ApiError ? err.message : t.failedLoadBalanceSheet)
      })
    return () => controller.abort()
  }, [asOf, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  if (fetchStatus === 'loading') {
    return (
      <AppShell>
        <Header title={t.balanceSheet} backTo={ROUTES.REPORTS} />
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
        <Header title={t.balanceSheet} backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadBalanceSheet} message={t.checkConnectionRetry} onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title={t.balanceSheet} backTo={ROUTES.REPORTS} />
      <PageContainer>
        <div className="finance-date-bar fade-up">
          <span className="finance-date-bar__label">{t.asOf}</span>
          <input type="date" className="finance-date-bar__input" value={asOf} onChange={(e) => setAsOf(e.target.value)} aria-label={t.asOfDate} />
          <button type="button" className="finance-date-bar__refresh-btn" onClick={refresh} aria-label={t.refreshBalanceSheet}>
            <RefreshCw size={14} aria-hidden="true" />
          </button>
        </div>

        {!data && (
          <div className="finance-empty">
            <div className="finance-empty__icon" aria-hidden="true"><BarChart3 size={32} /></div>
            <p className="finance-empty__title">{t.noDataForThisDate}</p>
            <p className="finance-empty__desc">{t.tryDifferentDate}</p>
          </div>
        )}

        {data && (
          <>
            <SectionCard section={data.assets} />
            <SectionCard section={data.liabilities} />
            <SectionCard section={data.equity} />
            <div className="finance-net-row">
              <span className="finance-net-row__label">{t.totalAssets}</span>
              <span className="finance-net-row__amount">{formatPaise(data.assets.total)}</span>
            </div>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
