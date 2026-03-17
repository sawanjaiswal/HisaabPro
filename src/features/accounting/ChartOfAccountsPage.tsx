/** Chart of Accounts — Accounts grouped by type with balances */

import { BookOpen } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ROUTES } from '@/config/routes.config'
import { useChartOfAccounts } from './useChartOfAccounts'
import { AccountGroupSection } from './components/AccountGroupSection'
import { sumGroupBalance } from './accounting.utils'
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ORDER } from './accounting.constants'
import './accounting.css'

export default function ChartOfAccountsPage() {
  const { grouped, total, status, isSeedingLoading, refresh, handleSeed } =
    useChartOfAccounts()

  const seedAction = (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={handleSeed}
      disabled={isSeedingLoading}
      aria-label="Seed default chart of accounts"
    >
      {isSeedingLoading ? 'Seeding…' : 'Seed Defaults'}
    </button>
  )

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title="Chart of Accounts" backTo={ROUTES.REPORTS} actions={seedAction} />
        <PageContainer>
          <div className="mb-3"><Skeleton height="64px" /></div>
          <div className="mb-3"><Skeleton height="64px" /></div>
          <div className="mb-3"><Skeleton height="64px" /></div>
          <Skeleton height="64px" />
        </PageContainer>
      </AppShell>
    )
  }

  if (status === 'error') {
    return (
      <AppShell>
        <Header title="Chart of Accounts" backTo={ROUTES.REPORTS} actions={seedAction} />
        <PageContainer>
          <ErrorState title="Could not load accounts" onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  if (total === 0) {
    return (
      <AppShell>
        <Header title="Chart of Accounts" backTo={ROUTES.REPORTS} actions={seedAction} />
        <PageContainer>
          <EmptyState
            icon={<BookOpen size={28} aria-hidden="true" />}
            title="No accounts yet"
            description="Seed default accounts to get started with double-entry bookkeeping."
            action={
              <button
                type="button"
                className="btn btn-primary btn-md"
                onClick={handleSeed}
                disabled={isSeedingLoading}
              >
                {isSeedingLoading ? 'Creating…' : 'Seed Default Accounts'}
              </button>
            }
          />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title="Chart of Accounts" backTo={ROUTES.REPORTS} actions={seedAction} />
      <PageContainer>
        <div className="acc-page">
          {ACCOUNT_TYPE_ORDER.map((type) => {
            const accounts = grouped.get(type) ?? []
            return (
              <AccountGroupSection
                key={type}
                type={type}
                label={ACCOUNT_TYPE_LABELS[type]}
                accounts={accounts}
                groupBalance={sumGroupBalance(accounts)}
              />
            )
          })}
        </div>
      </PageContainer>
    </AppShell>
  )
}
