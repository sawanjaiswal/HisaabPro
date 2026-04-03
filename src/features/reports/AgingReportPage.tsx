/** Aging Report Page
 *
 * Receivable / Payable tabs. Table with aging buckets.
 * 4 UI states.
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Clock } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { formatPaise } from '@/lib/format'
import { getAgingReport } from './finance.service'
import type { AgingReportData, AgingType } from './finance.types'
import './report-finance.css'
import { useLanguage } from '@/hooks/useLanguage'

export default function AgingReportPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const [agingType, setAgingType] = useState<AgingType>('RECEIVABLE')
  const [data, setData] = useState<AgingReportData | null>(null)
  const [fetchStatus, setFetchStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setFetchStatus('loading')
    getAgingReport(agingType, controller.signal)
      .then((d) => { setData(d); setFetchStatus('success') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchStatus('error')
        toast.error(err instanceof ApiError ? err.message : t.failedLoadAging)
      })
    return () => controller.abort()
  }, [agingType, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  if (fetchStatus === 'loading') {
    return (
      <AppShell>
        <Header title={t.agingReport} backTo={ROUTES.REPORTS} />
        <PageContainer>
          <div className="finance-skeleton" aria-busy="true">
            {['sk-1', 'sk-2'].map((k) => <div key={k} className="finance-skeleton__section" />)}
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (fetchStatus === 'error') {
    return (
      <AppShell>
        <Header title={t.agingReport} backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadAging} message={t.checkConnectionRetry} onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title={t.agingReport} backTo={ROUTES.REPORTS} />
      <PageContainer>
        <div className="aging-tabs stagger-filters" role="group" aria-label={t.reportType}>
          <button type="button" className={`aging-tab${agingType === 'RECEIVABLE' ? ' aging-tab--active' : ''}`} onClick={() => setAgingType('RECEIVABLE')} aria-pressed={agingType === 'RECEIVABLE'}>{t.receivable}</button>
          <button type="button" className={`aging-tab${agingType === 'PAYABLE' ? ' aging-tab--active' : ''}`} onClick={() => setAgingType('PAYABLE')} aria-pressed={agingType === 'PAYABLE'}>{t.payable}</button>
        </div>

        <button type="button" className="finance-date-bar__refresh-btn aging-refresh-btn" onClick={refresh} aria-label={t.refreshAgingReport}>
          <RefreshCw size={14} aria-hidden="true" /> {t.refresh}
        </button>

        {(!data || data.rows.length === 0) && (
          <div className="finance-empty">
            <div className="finance-empty__icon" aria-hidden="true"><Clock size={32} /></div>
            <p className="finance-empty__title">{agingType === 'RECEIVABLE' ? t.noOutstandingReceivables : t.noOutstandingPayables}</p>
            <p className="finance-empty__desc">{t.allBalancesSettled}</p>
          </div>
        )}

        {data && data.rows.length > 0 && (
          <div className="aging-table stagger-list">
            <table aria-label={agingType === 'RECEIVABLE' ? t.receivablesAging : t.payablesAging}>
              <thead>
                <tr>
                  <th scope="col">{t.party}</th>
                  <th scope="col">{t.current}</th>
                  <th scope="col">{t.days31to60}</th>
                  <th scope="col">{t.days61to90}</th>
                  <th scope="col">{t.over90}</th>
                  <th scope="col">{t.total}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.partyId}>
                    <td>{row.partyName}</td>
                    <td>{formatPaise(row.current)}</td>
                    <td>{formatPaise(row.days31to60)}</td>
                    <td>{formatPaise(row.days61to90)}</td>
                    <td>{formatPaise(row.over90)}</td>
                    <td>{formatPaise(row.total)}</td>
                  </tr>
                ))}
                <tr className="aging-table__total">
                  <td>{t.total}</td>
                  <td>{formatPaise(data.totals.current)}</td>
                  <td>{formatPaise(data.totals.days31to60)}</td>
                  <td>{formatPaise(data.totals.days61to90)}</td>
                  <td>{formatPaise(data.totals.over90)}</td>
                  <td>{formatPaise(data.totals.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </PageContainer>
    </AppShell>
  )
}
