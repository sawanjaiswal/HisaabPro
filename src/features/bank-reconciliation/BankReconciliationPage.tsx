/**
 * Bank Reconciliation (#147) — List Page
 * 4 UI states: loading · error · empty · success.
 * Upload a bank CSV, auto-match to payments, confirm/ignore/un-reconcile.
 */
import { Landmark } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useBankReconciliation } from './hooks/useBankReconciliation'
import { StatementUpload } from './components/StatementUpload'
import { ReconcileSummary } from './components/ReconcileSummary'
import { MatchRow } from './components/MatchRow'
import type { ParsedCsvRow } from './bank-reconciliation.types'
import './bank-reconciliation.css'

export default function BankReconciliationPage() {
  const { t } = useLanguage()
  const r = useBankReconciliation()

  function handleImport(bankAccountId: string, fileName: string, rows: ParsedCsvRow[]) {
    r.setAccountId(bankAccountId)
    r.importStatement({ bankAccountId, fileName, rows })
  }

  return (
    <AppShell>
      <Header title={t.bankReconTitle} backTo={ROUTES.DASHBOARD} />
      <PageContainer variant="list" className="space-y-6">
        <p className="recon-subtitle">{t.bankReconSubtitle}</p>

        <StatementUpload onImport={handleImport} isImporting={r.isImporting} />

        <ReconcileSummary active={r.tab} onChange={r.setTab} />

        {r.status === 'loading' && (
          <div className="recon-list" aria-busy="true">
            <Skeleton count={4} height="64px" borderRadius="var(--radius-xl)" />
          </div>
        )}

        {r.status === 'error' && (
          <ErrorState title={t.bankReconErrorTitle} onRetry={r.refresh} />
        )}

        {r.status === 'success' && r.lines.length === 0 && (
          <EmptyState
            icon={<Landmark size={22} aria-hidden="true" />}
            title={t.bankReconEmptyTitle}
            description={t.bankReconEmptyDesc}
          />
        )}

        {r.status === 'success' && r.lines.length > 0 && (
          <div className="recon-list">
            {r.lines.map((line) => (
              <MatchRow
                key={line.id}
                line={line}
                onConfirm={r.confirm}
                onIgnore={r.ignore}
                onUnreconcile={r.unreconcile}
              />
            ))}
          </div>
        )}
      </PageContainer>
    </AppShell>
  )
}
