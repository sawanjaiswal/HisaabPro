/** PayrollRunDetailPage — Phase 6 PR6 FE
 *
 * /hr/payroll/:id — single payroll run summary + Reverse action.
 *
 * BE constraint: no `GET /payroll/run/:id` exists yet (the BE exposes
 * only preview / finalize / reverse / snapshot in PR6). For now we
 * accept the run summary via React Router location state — the
 * finalize result and toast-action navigation carry the period + totals.
 *
 * If the user lands here via a bookmark (no router state), we render a
 * "Summary not available — open from the finalize toast or AuditLog"
 * note and the Reverse button still works because we have the run id
 * from the URL params.
 *
 * 4 UI states:
 *   loading — N/A (no fetch yet)
 *   error   — N/A
 *   empty   — bookmark-only landing (no router state)
 *   success — run summary + Reverse CTA
 */

import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Info } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Badge } from '@/components/ui/Badge'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate, formatPaise } from '@/lib/format'
import {
  PAYROLL_STATUS_BADGE_VARIANT,
  PAYROLL_STATUS_I18N_KEYS,
  type PayrollRunStatus,
} from './hr.constants'
import { PayrollReverseButton } from './components/PayrollReverseButton'

interface RunDetailLocationState {
  fromDate?: string
  toDate?: string
  count?: number
  totalNetPaise?: number
  status?: PayrollRunStatus
}

export default function PayrollRunDetailPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const location = useLocation()
  const id = params.id

  const state = (location.state ?? {}) as RunDetailLocationState
  const hasSummary = Boolean(state.fromDate && state.toDate)
  const status: PayrollRunStatus = state.status ?? 'FINALIZED'

  if (!id) {
    return (
      <AppShell>
        <Header title={t.payrollRunDetailTitle as string} backTo={ROUTES.HR_PAYROLL} />
        <PageContainer variant="detail">
          <ErrorState
            title={t.payrollRunNotFoundTitle as string}
            message={t.payrollRunNotFoundDescription as string}
            onRetry={() => navigate(ROUTES.HR_PAYROLL)}
            retryLabel={t.payrollBackToHub as string}
          />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title={t.payrollRunDetailTitle as string} backTo={ROUTES.HR_PAYROLL} />
      <PageContainer variant="detail" className="space-y-4">
        <div style={{ paddingBottom: 'calc(var(--bottom-nav-height) + 5rem)' }}>
          <article
            className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] p-4 space-y-3"
            aria-label={t.payrollRunSummaryLabel as string}
          >
            <header className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-success-50)] text-[var(--color-success-600)]"
              >
                <CheckCircle2 size={20} />
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="text-[var(--fs-base)] font-semibold text-[var(--color-text)]">
                  {t.payrollRunSummaryLabel as string}
                </h2>
                <p className="text-[var(--fs-sm)] text-[var(--color-text-secondary)] break-all mt-1">
                  {id}
                </p>
              </div>
              <Badge variant={PAYROLL_STATUS_BADGE_VARIANT[status]}>
                {t[PAYROLL_STATUS_I18N_KEYS[status] as keyof typeof t] as string}
              </Badge>
            </header>

            {hasSummary ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[var(--fs-sm)] pt-2">
                <dt className="text-[var(--color-text-secondary)]">{t.payrollFromDateLabel as string}</dt>
                <dd className="text-right text-[var(--color-text)]">{formatDate(state.fromDate as string)}</dd>

                <dt className="text-[var(--color-text-secondary)]">{t.payrollToDateLabel as string}</dt>
                <dd className="text-right text-[var(--color-text)]">{formatDate(state.toDate as string)}</dd>

                {typeof state.count === 'number' && (
                  <>
                    <dt className="text-[var(--color-text-secondary)]">{t.payrollEmployeesCountLabel as string}</dt>
                    <dd className="text-right tabular-nums text-[var(--color-text)]">{state.count}</dd>
                  </>
                )}

                {typeof state.totalNetPaise === 'number' && (
                  <>
                    <dt className="text-[var(--fs-base)] text-[var(--color-text)] font-semibold">{t.payrollColNet as string}</dt>
                    <dd className="text-right tabular-nums text-[var(--fs-base)] font-semibold text-[var(--color-text)]">
                      {formatPaise(state.totalNetPaise)}
                    </dd>
                  </>
                )}
              </dl>
            ) : (
              <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-3 text-[var(--fs-sm)] text-[var(--color-text-secondary)]">
                <Info size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
                <p>{t.payrollRunSummaryUnavailable as string}</p>
              </div>
            )}
          </article>
        </div>
      </PageContainer>

      {/* Sticky action bar — Reverse only when FINALIZED */}
      {status === 'FINALIZED' && hasSummary && (
        <div
          role="region"
          aria-label={t.payrollRunActionsLabel as string}
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'var(--bottom-nav-height)',
            zIndex: 2,
            display: 'flex',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <PayrollReverseButton
            payrollRunId={id}
            fromDate={state.fromDate as string}
            toDate={state.toDate as string}
            onReversed={() => navigate(ROUTES.HR_PAYROLL)}
          />
        </div>
      )}
    </AppShell>
  )
}
