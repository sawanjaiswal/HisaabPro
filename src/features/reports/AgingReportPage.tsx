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
import { getAgingReport } from './finance.service'
import type { AgingReportData, AgingType } from './finance.types'
import './report-finance.css'

function formatPaise(p: number): string {
  return (p / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
}

export default function AgingReportPage() {
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
        toast.error(err instanceof ApiError ? err.message : 'Failed to load aging report')
      })
    return () => controller.abort()
  }, [agingType, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  if (fetchStatus === 'loading') {
    return (
      <AppShell>
        <Header title="Aging Report" backTo={ROUTES.REPORTS} />
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
        <Header title="Aging Report" backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ErrorState title="Could not load aging report" message="Check your connection and try again." onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title="Aging Report" backTo={ROUTES.REPORTS} />
      <PageContainer>
        <div className="aging-tabs" role="group" aria-label="Report type">
          <button type="button" className={`aging-tab${agingType === 'RECEIVABLE' ? ' aging-tab--active' : ''}`} onClick={() => setAgingType('RECEIVABLE')} aria-pressed={agingType === 'RECEIVABLE'}>Receivable</button>
          <button type="button" className={`aging-tab${agingType === 'PAYABLE' ? ' aging-tab--active' : ''}`} onClick={() => setAgingType('PAYABLE')} aria-pressed={agingType === 'PAYABLE'}>Payable</button>
        </div>

        <button type="button" className="finance-date-bar__refresh-btn" onClick={refresh} style={{ marginBottom: 'var(--space-4)' }} aria-label="Refresh aging report">
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>

        {(!data || data.rows.length === 0) && (
          <div className="finance-empty">
            <div className="finance-empty__icon" aria-hidden="true"><Clock size={32} /></div>
            <p className="finance-empty__title">No outstanding {agingType === 'RECEIVABLE' ? 'receivables' : 'payables'}</p>
            <p className="finance-empty__desc">All balances are settled.</p>
          </div>
        )}

        {data && data.rows.length > 0 && (
          <div className="aging-table">
            <table aria-label={`${agingType === 'RECEIVABLE' ? 'Receivables' : 'Payables'} aging`}>
              <thead>
                <tr>
                  <th scope="col">Party</th>
                  <th scope="col">Current</th>
                  <th scope="col">31-60 days</th>
                  <th scope="col">61-90 days</th>
                  <th scope="col">Over 90</th>
                  <th scope="col">Total</th>
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
                  <td>Total</td>
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
