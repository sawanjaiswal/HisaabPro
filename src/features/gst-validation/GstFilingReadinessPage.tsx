/** Smart GST filing assistant (#144) — pre-filing readiness check.
 *
 * Deterministic rules engine over a period's sale/note documents. Surfaces
 * blockers (must-fix before filing) and warnings before GSTR-1 / GSTR-3B
 * export. Read-only. 4 UI states. */

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useFilingReadiness } from './hooks/useFilingReadiness'
import { ReadinessSummary } from './components/ReadinessSummary'
import { CheckRow } from './components/CheckRow'
import { GST_READINESS_RETURN_TYPES } from './gst-validation.constants'
import './gst-validation.css'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

function currentPeriod(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

type ReturnType = (typeof GST_READINESS_RETURN_TYPES)[number]

export default function GstFilingReadinessPage() {
  const { t } = useLanguage()
  const [period, setPeriod] = useState(currentPeriod)
  const [returnType, setReturnType] = useState<ReturnType>('GSTR1')

  const { data, isLoading, isError, refetch } = useFilingReadiness(period, returnType)

  const checks = data?.checks ?? []
  const hasNoIssues = !isLoading && !isError && data != null && checks.length === 0

  return (
    <AppShell>
      <Header title={t.gstReadinessTitle} backTo={ROUTES.MORE} />
      <PageContainer variant="list" className="space-y-6">
        <div className="gstv-controls">
          <div className="gstv-field">
            <label className="gstv-field__label" htmlFor="gstv-period">
              {t.gstReadinessPeriod}
            </label>
            <Input
              id="gstv-period"
              type="month"
              className="gstv-period-input"
              value={period}
              max={currentPeriod()}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>

          <div className="gstv-tabs" role="group" aria-label={t.gstReadinessReturnType}>
            {GST_READINESS_RETURN_TYPES.map((rt) => (
              <Button variant="none"
                key={rt}
                type="button"
                className={`gstv-tab${returnType === rt ? ' gstv-tab--active' : ''}`}
                onClick={() => setReturnType(rt)}
                aria-pressed={returnType === rt}
              >
                {rt === 'GSTR1' ? t.gstReadinessGstr1 : t.gstReadinessGstr3b}
              </Button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="space-y-6" aria-busy="true">
            <Skeleton height="120px" borderRadius="var(--radius-xl)" />
            <Skeleton height="200px" borderRadius="var(--radius-xl)" />
          </div>
        )}

        {!isLoading && isError && (
          <ErrorState
            title={t.gstReadinessErrorTitle}
            message={t.checkConnectionRetry}
            onRetry={() => refetch()}
          />
        )}

        {hasNoIssues && (
          <>
            <ReadinessSummary data={data} />
            <EmptyState
              icon={<ShieldCheck size={32} aria-hidden="true" />}
              title={t.gstReadinessNoIssues}
              description={t.gstReadinessNoIssuesDesc}
            />
          </>
        )}

        {!isLoading && !isError && data != null && checks.length > 0 && (
          <>
            <ReadinessSummary data={data} />
            <ul className="gstv-list stagger-list">
              {checks.map((check) => (
                <CheckRow key={check.id} check={check} />
              ))}
            </ul>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
