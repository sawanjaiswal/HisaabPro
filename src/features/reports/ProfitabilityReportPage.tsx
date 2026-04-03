/** Profitability Report Page
 *
 * Group by Party / Product / Document toggle.
 * Shows revenue, COGS, gross profit, margin%.
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
import { getProfitability } from './finance.service'
import type { ProfitabilityData, ProfitabilityGroupBy } from './finance.types'
import './report-finance.css'
import { useLanguage } from '@/hooks/useLanguage'

function marginClass(m: number): string {
  if (m >= 30) return 'profit-table__margin--high'
  if (m >= 15) return 'profit-table__margin--mid'
  return 'profit-table__margin--low'
}

function getMonthRange() {
  const now = new Date()
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
  }
}

const GROUP_OPTIONS_BASE: { value: ProfitabilityGroupBy; labelKey: 'byParty' | 'byProduct' | 'byDocument' }[] = [
  { value: 'PARTY', labelKey: 'byParty' },
  { value: 'PRODUCT', labelKey: 'byProduct' },
  { value: 'DOCUMENT', labelKey: 'byDocument' },
]

export default function ProfitabilityReportPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const [dateRange, setDateRange] = useState(getMonthRange)
  const [groupBy, setGroupBy] = useState<ProfitabilityGroupBy>('PARTY')
  const [data, setData] = useState<ProfitabilityData | null>(null)
  const [fetchStatus, setFetchStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setFetchStatus('loading')
    getProfitability(dateRange.from, dateRange.to, groupBy, controller.signal)
      .then((d) => { setData(d); setFetchStatus('success') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchStatus('error')
        toast.error(err instanceof ApiError ? err.message : t.failedLoadProfitability)
      })
    return () => controller.abort()
  }, [dateRange, groupBy, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  if (fetchStatus === 'loading') {
    return (
      <AppShell>
        <Header title={t.profitability} backTo={ROUTES.REPORTS} />
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
        <Header title={t.profitability} backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadProfitability} message={t.checkConnectionRetry} onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title={t.profitabilityReport} backTo={ROUTES.REPORTS} />
      <PageContainer>
        <div className="finance-date-bar">
          <span className="finance-date-bar__label">{t.from}</span>
          <input type="date" className="finance-date-bar__input" value={dateRange.from} onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))} aria-label={t.fromDate} />
          <span className="finance-date-bar__label">{t.to}</span>
          <input type="date" className="finance-date-bar__input" value={dateRange.to} onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))} aria-label={t.toDate} />
          <button type="button" className="finance-date-bar__refresh-btn" onClick={refresh} aria-label={t.refresh}>
            <RefreshCw size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="aging-tabs stagger-filters" role="group" aria-label={t.groupBy}>
          {GROUP_OPTIONS_BASE.map((opt) => (
            <button key={opt.value} type="button" className={`aging-tab${groupBy === opt.value ? ' aging-tab--active' : ''}`} onClick={() => setGroupBy(opt.value)} aria-pressed={groupBy === opt.value}>{t[opt.labelKey]}</button>
          ))}
        </div>

        {(!data || data.rows.length === 0) && (
          <div className="finance-empty">
            <div className="finance-empty__icon" aria-hidden="true"><BarChart3 size={32} /></div>
            <p className="finance-empty__title">{t.noDataForThisPeriod}</p>
            <p className="finance-empty__desc">{t.tryDifferentGrouping}</p>
          </div>
        )}

        {data && data.rows.length > 0 && (
          <div className="profit-table stagger-list">
            <table aria-label={t.profitabilityBreakdown}>
              <thead>
                <tr>
                  <th scope="col">{GROUP_OPTIONS_BASE.find((g) => g.value === groupBy)?.labelKey ? t[GROUP_OPTIONS_BASE.find((g) => g.value === groupBy)!.labelKey] : t.group ?? 'Group'}</th>
                  <th scope="col">{t.revenue}</th>
                  <th scope="col">{t.cogs}</th>
                  <th scope="col">{t.grossProfit}</th>
                  <th scope="col">{t.margin}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.groupId}>
                    <td>{row.groupLabel}</td>
                    <td>{formatPaise(row.revenue)}</td>
                    <td>{formatPaise(row.costOfGoods)}</td>
                    <td>{formatPaise(row.grossProfit)}</td>
                    <td className={marginClass(row.grossMargin)}>{row.grossMargin.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageContainer>
    </AppShell>
  )
}
