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

const GROUP_OPTIONS: { value: ProfitabilityGroupBy; label: string }[] = [
  { value: 'PARTY', label: 'By Party' },
  { value: 'PRODUCT', label: 'By Product' },
  { value: 'DOCUMENT', label: 'By Document' },
]

export default function ProfitabilityReportPage() {
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
        toast.error(err instanceof ApiError ? err.message : 'Failed to load profitability report')
      })
    return () => controller.abort()
  }, [dateRange, groupBy, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  if (fetchStatus === 'loading') {
    return (
      <AppShell>
        <Header title="Profitability" backTo={ROUTES.REPORTS} />
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
        <Header title="Profitability" backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ErrorState title="Could not load profitability report" message="Check your connection and try again." onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title="Profitability Report" backTo={ROUTES.REPORTS} />
      <PageContainer>
        <div className="finance-date-bar">
          <span className="finance-date-bar__label">From</span>
          <input type="date" className="finance-date-bar__input" value={dateRange.from} onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))} aria-label="From date" />
          <span className="finance-date-bar__label">To</span>
          <input type="date" className="finance-date-bar__input" value={dateRange.to} onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))} aria-label="To date" />
          <button type="button" className="finance-date-bar__refresh-btn" onClick={refresh} aria-label="Refresh">
            <RefreshCw size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="aging-tabs" role="group" aria-label="Group by">
          {GROUP_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" className={`aging-tab${groupBy === opt.value ? ' aging-tab--active' : ''}`} onClick={() => setGroupBy(opt.value)} aria-pressed={groupBy === opt.value}>{opt.label}</button>
          ))}
        </div>

        {(!data || data.rows.length === 0) && (
          <div className="finance-empty">
            <div className="finance-empty__icon" aria-hidden="true"><BarChart3 size={32} /></div>
            <p className="finance-empty__title">No data for this period</p>
            <p className="finance-empty__desc">Try a different date range or grouping.</p>
          </div>
        )}

        {data && data.rows.length > 0 && (
          <div className="profit-table">
            <table aria-label="Profitability breakdown">
              <thead>
                <tr>
                  <th scope="col">{GROUP_OPTIONS.find((g) => g.value === groupBy)?.label.replace('By ', '') ?? 'Group'}</th>
                  <th scope="col">Revenue</th>
                  <th scope="col">COGS</th>
                  <th scope="col">Gross Profit</th>
                  <th scope="col">Margin</th>
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
