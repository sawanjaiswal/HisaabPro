/** PayrollWizardPage — Phase 6 PR6 FE
 *
 * /hr/payroll/new — 2-step wizard:
 *
 *   1. Pick period + employee subset + payment mode  (PayrollWizardStepDates)
 *   2. Review preview table → Finalize (PayrollPreviewTable + PayrollFinalizeButton)
 *
 * The preview is a server-side compute; we manually trigger via
 * `usePayrollPreview(req, enabled).refetch()` on the "Preview" CTA so we
 * stay under the 10/min/business BE rate limit (a user typing dates would
 * otherwise burn the budget on every keystroke).
 *
 * On finalize success WHILE ONLINE: navigate to PayrollRunDetailPage.
 * On finalize success WHILE OFFLINE: stay on the wizard — the toast shown
 * by `usePayrollMutations` carries the "will sync when online" suffix and
 * the result is `{}` (no payrollRunId to deep-link to).
 *
 * 4 UI states (preview):
 *   loading  → spinner under the "Preview" CTA
 *   error    → ErrorState with retry (covers 429 too — the rate limit
 *              toast is shown by usePayrollPreview's retry: false rule)
 *   empty    → "No employees to pay in this period" — shown when totals.count===0
 *   success  → PayrollPreviewTable + PayrollFinalizeButton
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { toLocalISODate } from '@/lib/format'
import { useEmployees } from './useEmployees'
import { usePayrollPreview } from './usePayroll'
import { PayrollWizardStepDates } from './components/PayrollWizardStepDates'
import { PayrollPreviewTable } from './components/PayrollPreviewTable'
import { PayrollFinalizeButton } from './components/PayrollFinalizeButton'
import type { PayrollFinalizeResult, PayrollWizardState } from './payroll.types'

/** First-of-month → today as a sensible default. */
function defaultPeriod(): { fromDate: string; toDate: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  return { fromDate: toLocalISODate(from), toDate: toLocalISODate(now) }
}

export default function PayrollWizardPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const employeesQuery = useEmployees()

  const initial = useMemo<PayrollWizardState>(
    () => ({ ...defaultPeriod(), employeeIds: [], mode: 'CASH' }),
    [],
  )

  // 'dates' = step 1; 'preview' = step 2.
  const [step, setStep] = useState<'dates' | 'preview'>('dates')
  const [state, setState] = useState<PayrollWizardState>(initial)
  const [previewEnabled, setPreviewEnabled] = useState(false)

  const previewQuery = usePayrollPreview(
    {
      fromDate: state.fromDate,
      toDate: state.toDate,
      employeeIds: state.employeeIds.length > 0 ? state.employeeIds : undefined,
    },
    previewEnabled,
  )

  function handleContinueDates(next: PayrollWizardState) {
    setState(next)
    setStep('preview')
    setPreviewEnabled(true)
  }

  function handleBackToDates() {
    setStep('dates')
    setPreviewEnabled(false)
  }

  function handleFinalized(result: PayrollFinalizeResult | Record<string, never>) {
    // When online, result.payrollRunId exists → deep-link.
    // When queued offline, result === {} → stay put (toast already shown).
    if ('payrollRunId' in result && typeof result.payrollRunId === 'string') {
      navigate(ROUTES.HR_PAYROLL_DETAIL.replace(':id', result.payrollRunId))
    } else {
      navigate(ROUTES.HR_PAYROLL)
    }
  }

  return (
    <AppShell>
      <Header title={t.payrollWizardTitle as string} backTo={ROUTES.HR_PAYROLL} />
      <PageContainer variant="form" className="space-y-4">
        <div style={{ paddingBottom: 'calc(var(--bottom-nav-height) + 5rem)' }}>
          {step === 'dates' && (
            <PayrollWizardStepDates
              employees={employeesQuery.employees}
              initial={state}
              onContinue={handleContinueDates}
              busy={employeesQuery.status === 'loading'}
            />
          )}

          {step === 'preview' && (
            <section className="space-y-4">
              <header className="flex items-center justify-between gap-2">
                <h2 className="text-[var(--fs-base)] font-semibold text-[var(--color-text)]">
                  {t.payrollPreviewHeading as string}
                </h2>
                <Button variant="ghost" size="sm" onClick={handleBackToDates}>
                  {t.payrollPreviewEditDates as string}
                </Button>
              </header>

              {previewQuery.status === 'loading' && (
                <div aria-busy="true" aria-label={t.loading as string} className="space-y-2">
                  <Skeleton height="48px" />
                  <Skeleton height="48px" />
                  <Skeleton height="48px" />
                </div>
              )}

              {previewQuery.status === 'error' && (
                <ErrorState
                  title={t.payrollPreviewError as string}
                  onRetry={() => previewQuery.refetch()}
                  retryLabel={t.retry as string}
                />
              )}

              {previewQuery.status === 'success' && previewQuery.preview && previewQuery.preview.totals.count === 0 && (
                <EmptyState
                  title={t.payrollPreviewEmptyTitle as string}
                  description={t.payrollPreviewEmptyDescription as string}
                />
              )}

              {previewQuery.status === 'success' && previewQuery.preview && previewQuery.preview.totals.count > 0 && (
                <>
                  <PayrollPreviewTable
                    lines={previewQuery.preview.lines}
                    totals={previewQuery.preview.totals}
                  />
                  <PayrollFinalizeButton
                    state={state}
                    preview={previewQuery.preview}
                    onFinalized={handleFinalized}
                  />
                </>
              )}
            </section>
          )}
        </div>
      </PageContainer>
    </AppShell>
  )
}
