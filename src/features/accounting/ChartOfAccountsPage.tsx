/** Chart of Accounts — Accounts grouped by type with balances */

import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ROUTES } from '@/config/routes.config'
import { useChartOfAccounts } from './useChartOfAccounts'
import { AccountGroupSection } from './components/AccountGroupSection'
import { sumGroupBalance } from './accounting.utils'
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ORDER } from './accounting.constants'
import './accounting.css'
import { useLanguage } from '@/hooks/useLanguage'

export default function ChartOfAccountsPage() {
  const { t } = useLanguage()
  const { grouped, total, status, isSeedingLoading, refresh, handleSeed } =
    useChartOfAccounts()

  const seedAction = (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleSeed}
      disabled={isSeedingLoading}
      aria-label={t.seedDefaultAccounts}
    >
      {isSeedingLoading ? t.creatingAccounts : t.seedDefaultAccountsBtn}
    </Button>
  )

  return (
    <AppShell>
      <Header title={t.chartOfAccounts ?? "Chart of Accounts"} backTo={ROUTES.REPORTS} actions={seedAction} />
      <HeroPage>
        {status === 'loading' && (
          <div className="space-y-3" aria-busy="true">
            <Skeleton height="64px" />
            <Skeleton height="64px" />
            <Skeleton height="64px" />
            <Skeleton height="64px" />
          </div>
        )}

        {status === 'error' && (
          <ErrorState title={t.couldNotLoadAccounts} onRetry={refresh} />
        )}

        {status === 'success' && total === 0 && (
          <EmptyState
            icon={<BookOpen size={28} aria-hidden="true" />}
            title={t.noAccountsYet}
            description={t.seedDefaultAccounts}
            action={
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleSeed}
                disabled={isSeedingLoading}
              >
                {isSeedingLoading ? t.creatingAccounts : t.seedDefaultAccountsBtn}
              </Button>
            }
          />
        )}

        {status === 'success' && total > 0 && (
          <div className="acc-page stagger-enter space-y-6">
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
        )}
      </HeroPage>
    </AppShell>
  )
}
