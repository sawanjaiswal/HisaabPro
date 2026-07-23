/**
 * Commission #128 — Monthly leaderboard page (route: /commission/leaderboard).
 *
 * Requires server-side `commission.view_all` permission (owner + admins).
 * If the caller lacks the permission, the hook returns status='forbidden'
 * and we render a non-error empty-permission state instead of a generic
 * "Something went wrong" — the user simply isn't allowed to see this view,
 * so framing it as a failure would be misleading.
 *
 * 4 UI states delegated to <LeaderboardTable>; the page owns the period
 * picker + the forbidden state.
 */

import { useState } from 'react'
import { Calendar, Lock } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { LeaderboardTable } from '../components/LeaderboardTable'
import { currentPeriodYearMonth, formatPeriodLabel } from '../commission.utils'
import '@/styles/components.commission.css'
import { DateField } from '@/components/ui/DateField'

export default function LeaderboardPage() {
  const { t } = useLanguage()
  const [period, setPeriod] = useState<string>(currentPeriodYearMonth())

  const { data, status, refresh } = useLeaderboard({ periodYearMonth: period })

  return (
    <AppShell>
      <Header title={t.commissionLeaderboardHeader} backTo={ROUTES.DASHBOARD} />

      <PageContainer variant="list">
        <div className="commission-leaderboard__period-row">
          <label
            htmlFor="commission-leaderboard-period"
            className="commission-leaderboard__period-label"
          >
            <Calendar size={14} aria-hidden="true" />
            {t.commissionLeaderboardPeriodLabel}
          </label>
          <DateField
            id="commission-leaderboard-period"
            type="month"
            className="commission-leaderboard__period-input"
            value={period}
            onChange={(e) => setPeriod(e.target.value || currentPeriodYearMonth())}
            aria-label={t.commissionLeaderboardPeriodLabel}
          />
          <span className="commission-leaderboard__period-display">
            {formatPeriodLabel(period)}
          </span>
        </div>

        {status === 'forbidden' ? (
          <EmptyState
            icon={<Lock size={22} aria-hidden="true" />}
            title={t.commissionLeaderboardForbiddenTitle}
            description={t.commissionLeaderboardForbiddenDesc}
          />
        ) : (
          <LeaderboardTable
            rows={data?.entries ?? []}
            isLoading={status === 'loading'}
            isError={status === 'error'}
            onRetry={refresh}
          />
        )}
      </PageContainer>
    </AppShell>
  )
}
