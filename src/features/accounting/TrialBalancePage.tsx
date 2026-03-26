/** Trial Balance — Debit/credit totals as of a selected date */

import { Scale } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ROUTES } from '@/config/routes.config'
import { useTrialBalance } from './useTrialBalance'
import { TrialBalanceTable } from './components/TrialBalanceTable'
import { isBalanced, formatPaise } from './accounting.utils'
import './accounting.css'
import { useLanguage } from '@/hooks/useLanguage'

export default function TrialBalancePage() {
  const { t } = useLanguage()
  const { data, status, asOf, setAsOf, refresh } = useTrialBalance()

  const dateInput = (
    <input
      type="date"
      className="tb-date-input"
      value={asOf}
      max={new Date().toISOString().slice(0, 10)}
      onChange={(e) => setAsOf(e.target.value)}
      aria-label={t.asOfDateTrialBalance}
    />
  )

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title={t.trialBalance ?? "Trial Balance"} backTo={ROUTES.REPORTS} actions={dateInput} />
        <PageContainer>
          <Skeleton height="320px" />
        </PageContainer>
      </AppShell>
    )
  }

  if (status === 'error') {
    return (
      <AppShell>
        <Header title={t.trialBalance ?? "Trial Balance"} backTo={ROUTES.REPORTS} actions={dateInput} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadTrialBalance} onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  if (!data || data.rows.length === 0) {
    return (
      <AppShell>
        <Header title={t.trialBalance ?? "Trial Balance"} backTo={ROUTES.REPORTS} actions={dateInput} />
        <PageContainer>
          <EmptyState
            icon={<Scale size={28} aria-hidden="true" />}
            title={t.noDataAvailable}
            description={t.postJournalEntries}
          />
        </PageContainer>
      </AppShell>
    )
  }

  const balanced = isBalanced(data.totals.debit, data.totals.credit)

  return (
    <AppShell>
      <Header title={t.trialBalance ?? "Trial Balance"} backTo={ROUTES.REPORTS} actions={dateInput} />
      <PageContainer>
        {/* Balance indicator */}
        <div className={`tb-balance-chip ${balanced ? 'balanced' : 'unbalanced'}`} role="status">
          <span className="tb-balance-dot" aria-hidden="true" />
          {balanced
            ? `${t.balanced} — ${formatPaise(data.totals.debit)} ${t.eachSide}`
            : `${t.outOfBalanceBy} ${formatPaise(Math.abs(data.totals.debit - data.totals.credit))}`
          }
        </div>

        <TrialBalanceTable rows={data.rows} totals={data.totals} />
      </PageContainer>
    </AppShell>
  )
}
