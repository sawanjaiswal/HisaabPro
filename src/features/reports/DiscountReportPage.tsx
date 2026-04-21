/** Discount Report Page — shows discount amounts given on invoices */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Percent } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { formatPaise } from '@/lib/format'
import { getDiscountReport } from './finance.service'
import type { DiscountReportData } from './finance.types'
import './report-finance.css'
import { useLanguage } from '@/hooks/useLanguage'
import { toLocalISODate } from '../../lib/format'

function getMonthRange(): { from: string; to: string } {
  const now = new Date()
  const from = toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1))
  const to = toLocalISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  return { from, to }
}

export default function DiscountReportPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const [dateRange, setDateRange] = useState(getMonthRange)
  const [data, setData] = useState<DiscountReportData | null>(null)
  const [fetchStatus, setFetchStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setFetchStatus('loading')
    getDiscountReport(dateRange.from, dateRange.to, controller.signal)
      .then((d) => { setData(d); setFetchStatus('success') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchStatus('error')
        toast.error(err instanceof ApiError ? err.message : t.failedLoadDiscountReport)
      })
    return () => controller.abort()
  }, [dateRange, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  if (fetchStatus === 'loading') {
    return (
      <AppShell>
        <Header title={t.discountReport} backTo={ROUTES.REPORTS} />
        <PageContainer className="space-y-6">
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
        <Header title={t.discountReport} backTo={ROUTES.REPORTS} />
        <PageContainer className="space-y-6"><ErrorState title={t.couldNotLoadDiscountReport} message={t.checkConnectionRetry} onRetry={refresh} /></PageContainer>
      </AppShell>
    )
  }

  const rows = data?.rows ?? []

  return (
    <AppShell>
      <Header title={t.discountReport} backTo={ROUTES.REPORTS} />
      <PageContainer className="space-y-6">
        <div className="finance-date-bar">
          <span className="finance-date-bar__label">{t.from}</span>
          <input type="date" className="finance-date-bar__input" value={dateRange.from} onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))} aria-label={t.fromDate} />
          <span className="finance-date-bar__label">{t.to}</span>
          <input type="date" className="finance-date-bar__input" value={dateRange.to} onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))} aria-label={t.toDate} />
          <button type="button" className="finance-date-bar__refresh-btn" onClick={refresh} aria-label={t.refreshReport}><RefreshCw size={14} aria-hidden="true" /></button>
        </div>

        {rows.length === 0 && (
          <div className="finance-empty">
            <div className="finance-empty__icon" aria-hidden="true"><Percent size={32} /></div>
            <p className="finance-empty__title">{t.noDiscountsInPeriod}</p>
            <p className="finance-empty__desc">{t.tryDifferentDateRange}</p>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="finance-net-row">
              <span className="finance-net-row__label">{t.totalDiscountsGiven}</span>
              <span className="finance-net-row__amount">{formatPaise(data?.totalDiscount ?? 0)}</span>
            </div>
            <div className="aging-table stagger-list">
              <table aria-label={t.discountDetailsByInvoice}>
                <thead>
                  <tr>
                    <th scope="col">{t.invoice}</th>
                    <th scope="col">{t.party}</th>
                    <th scope="col">{t.discount}</th>
                    <th scope="col">%</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.documentId}>
                      <td>{row.documentNumber}</td>
                      <td>{row.partyName}</td>
                      <td>{formatPaise(row.discountAmount)}</td>
                      <td>{row.discountPercent.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
