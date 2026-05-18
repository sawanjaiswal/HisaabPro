/** PayrollPage — Phase 6 PR6 FE
 *
 * /hr/payroll — landing for the payroll feature. The BE currently exposes:
 *
 *   POST /payroll/run/preview
 *   POST /payroll/run/finalize
 *   POST /payroll/run/:id/reverse
 *   GET  /payroll/:id/snapshot
 *
 * — but NO `GET /payroll/run` list endpoint yet. So this page is a thin
 * hub: a primary "New payroll" CTA that routes to the wizard, an info
 * panel that explains the period model, and a deep-link area for arriving
 * at a known run/payslip id (the run-detail and payslip URLs are designed
 * to be link-shareable from finalize result toasts and AuditLog references).
 *
 * "Past runs list" is the obvious follow-on; tracked as an explicit scope
 * carve-out in the commit message.
 *
 * 4 UI states — this page has no data fetch, so it renders the same
 * "success" content always; loading/error/empty are N/A.
 */

import { useNavigate } from 'react-router-dom'
import { Plus, Wallet } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'

export default function PayrollPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <AppShell>
      <Header title={t.payrollTitle as string} backTo={ROUTES.HR_ATTENDANCE} />
      <PageContainer variant="dashboard" className="space-y-4">
        <div style={{ paddingBottom: 'calc(var(--bottom-nav-height) + 5rem)' }}>
          <article
            className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] p-4"
            aria-label={t.payrollHubIntroTitle as string}
          >
            <header className="flex items-start gap-3 mb-3">
              <span
                aria-hidden="true"
                className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-600)]"
              >
                <Wallet size={20} />
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="text-[var(--fs-base)] font-semibold text-[var(--color-text)]">
                  {t.payrollHubIntroTitle as string}
                </h2>
                <p className="text-[var(--fs-sm)] text-[var(--color-text-secondary)] mt-1">
                  {t.payrollHubIntroDescription as string}
                </p>
              </div>
            </header>
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate(ROUTES.HR_PAYROLL_NEW)}
              className="w-full"
            >
              <Plus size={18} aria-hidden="true" className="inline-block mr-1" />
              {t.payrollNewCta as string}
            </Button>
          </article>

          <article
            className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] p-4 mt-4"
            aria-label={t.payrollHubHowTitle as string}
          >
            <h3 className="text-[var(--fs-base)] font-semibold text-[var(--color-text)] mb-2">
              {t.payrollHubHowTitle as string}
            </h3>
            <ol className="list-decimal pl-5 space-y-1 text-[var(--fs-sm)] text-[var(--color-text-secondary)]">
              <li>{t.payrollHubStep1 as string}</li>
              <li>{t.payrollHubStep2 as string}</li>
              <li>{t.payrollHubStep3 as string}</li>
              <li>{t.payrollHubStep4 as string}</li>
            </ol>
          </article>
        </div>
      </PageContainer>
    </AppShell>
  )
}
