/** Financial Year Closure Page — close/reopen financial years */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Lock, Unlock, Calendar } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { formatPaise } from '@/lib/format'
import { getFYClosures, closeFY, reopenFY } from '@/features/reports/finance.service'
import type { FYClosure } from '@/features/reports/finance.types'
import './accounting.css'
import { useLanguage } from '@/hooks/useLanguage'

function fyLabel(fy: string): string {
  const s = 2000 + parseInt(fy.slice(0, 2), 10)
  const e = 2000 + parseInt(fy.slice(2, 4), 10)
  return `FY ${s}-${String(e).slice(2)}`
}

function getCurrentFY(): string {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const s = year % 100
  const e = (year + 1) % 100
  return `${String(s).padStart(2, '0')}${String(e).padStart(2, '0')}`
}

export default function FYClosurePage() {
  const { t } = useLanguage()
  const toast = useToast()
  const [closures, setClosures] = useState<FYClosure[]>([])
  const [fetchStatus, setFetchStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [refreshKey, setRefreshKey] = useState(0)
  const [closingFY, setClosingFY] = useState('')
  const [actionPending, setActionPending] = useState(false)
  const actionRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    setFetchStatus('loading')
    getFYClosures(controller.signal)
      .then((d) => { setClosures(Array.isArray(d) ? d : []); setFetchStatus('success') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchStatus('error')
        toast.error(err instanceof ApiError ? err.message : t.failedLoadFyClosures)
      })
    return () => controller.abort()
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  async function handleClose() {
    if (actionRef.current || !closingFY) return
    actionRef.current = true
    setActionPending(true)
    try {
      const result = await closeFY(closingFY)
      toast.success(`${fyLabel(closingFY)} closed. Net ${result.netProfit >= 0 ? t.fyProfit : t.fyLoss}: ${formatPaise(Math.abs(result.netProfit))}`)
      setClosingFY('')
      refresh()
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : t.failedCloseFy)
    } finally {
      setActionPending(false)
      actionRef.current = false
    }
  }

  async function handleReopen(fy: string) {
    if (actionRef.current) return
    actionRef.current = true
    setActionPending(true)
    try {
      await reopenFY(fy)
      toast.success(`${fyLabel(fy)} ${t.reopenFy}`)
      refresh()
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : t.failedReopenFy)
    } finally {
      setActionPending(false)
      actionRef.current = false
    }
  }

  if (fetchStatus === 'loading') {
    return (
      <AppShell>
        <Header title={t.fyClosurePage} backTo={ROUTES.CHART_OF_ACCOUNTS} />
        <PageContainer>
          <div className="acct-skeleton" aria-busy="true">
            {['sk-1', 'sk-2'].map((k) => <div key={k} className="acct-skeleton__block" />)}
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (fetchStatus === 'error') {
    return (
      <AppShell>
        <Header title={t.fyClosurePage} backTo={ROUTES.CHART_OF_ACCOUNTS} />
        <PageContainer><ErrorState title={t.couldNotLoadClosures} message={t.checkConnectionRetry} onRetry={refresh} /></PageContainer>
      </AppShell>
    )
  }

  const currentFY = getCurrentFY()
  const alreadyClosed = closures.some((c) => c.financialYear === currentFY && c.status === 'CLOSED')

  return (
    <AppShell>
      <Header title={t.fyClosurePage} backTo={ROUTES.CHART_OF_ACCOUNTS} />
      <PageContainer>
        <div className="fy-close-card">
          <div className="fy-close-card__header">
            <Calendar size={20} aria-hidden="true" />
            <span>{t.closeFinancialYear}</span>
          </div>
          <div className="fy-close-card__body">
            <input
              type="text"
              className="fy-close-card__input"
              placeholder={t.fyPlaceholder}
              maxLength={4}
              value={closingFY}
              onChange={(e) => setClosingFY(e.target.value.replace(/\D/g, '').slice(0, 4))}
              aria-label={t.fyAria}
            />
            <button
              type="button"
              className="fy-close-card__btn"
              onClick={handleClose}
              disabled={actionPending || closingFY.length !== 4}
              aria-label={t.closeFyAria.replace('{fy}', closingFY)}
            >
              <Lock size={14} aria-hidden="true" />
              {actionPending ? t.loading : t.closeFyBtn}
            </button>
          </div>
          {alreadyClosed && <p className="fy-close-card__note">{t.fyAlreadyClosedMsg.replace('{fy}', fyLabel(currentFY))}</p>}
        </div>

        {closures.length === 0 && (
          <div className="acct-empty">
            <div className="acct-empty__icon" aria-hidden="true"><Lock size={32} /></div>
            <p className="acct-empty__title">{t.noFyClosuresYet}</p>
            <p className="acct-empty__desc">{t.closeFyAbove}</p>
          </div>
        )}

        {closures.length > 0 && (
          <div className="fy-list">
            {closures.map((c) => (
              <div key={c.id} className={`fy-card fy-card--${c.status.toLowerCase()}`}>
                <div className="fy-card__header">
                  <span className="fy-card__fy">{fyLabel(c.financialYear)}</span>
                  <span className={`fy-card__status fy-card__status--${c.status.toLowerCase()}`}>{c.status}</span>
                </div>
                <div className="fy-card__details">
                  <span className="fy-card__detail">{t.retainedEarnings}: {formatPaise(c.retainedEarnings)}</span>
                  <span className="fy-card__detail">{t.closedDateLabel} {new Date(c.closedAt).toLocaleDateString('en-IN')}</span>
                </div>
                {c.status === 'CLOSED' && (
                  <button
                    type="button"
                    className="fy-card__reopen-btn"
                    onClick={() => handleReopen(c.financialYear)}
                    disabled={actionPending}
                    aria-label={t.reopenFyAria.replace('{fy}', fyLabel(c.financialYear))}
                  >
                    <Unlock size={14} aria-hidden="true" /> {t.reopenFy}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </PageContainer>
    </AppShell>
  )
}
