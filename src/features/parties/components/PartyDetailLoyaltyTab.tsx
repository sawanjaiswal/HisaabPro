/**
 * Loyalty #125 — Party-detail "Loyalty" tab.
 *
 * Mounted from PartyDetailPage when `useLoyaltyProgram().program?.enabled`.
 * Composes:
 *   • Disabled / empty state when program is off (with "Open settings" link)
 *   • Summary card — 4 cells (current · lifetime earned · lifetime redeemed
 *     · expiring soon)
 *   • Ledger list (LoyaltyLedgerList — owns its own 4 UI states)
 */

import { Link } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ROUTES } from '@/config/routes.config'
import { useLoyaltyProgram } from '@/features/loyalty/hooks/useLoyaltyProgram'
import { useLoyaltyBalance } from '@/features/loyalty/hooks/useLoyaltyBalance'
import { LoyaltyLedgerList } from '@/features/loyalty/components/LoyaltyLedgerList'
import { formatPoints } from '@/features/loyalty/loyalty.utils'
import '@/styles/components.loyalty.css'

interface PartyDetailLoyaltyTabProps {
  partyId: string
}

export function PartyDetailLoyaltyTab({ partyId }: PartyDetailLoyaltyTabProps) {
  const { t } = useLanguage()
  const { program, isLoading: programLoading } = useLoyaltyProgram()
  const isProgramOn = Boolean(program?.enabled)

  const { balance, isLoading: balanceLoading, isError: balanceError, refetch } =
    useLoyaltyBalance({ partyId, enabled: isProgramOn })

  if (programLoading) {
    return (
      <div
        aria-busy="true"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
      >
        <Skeleton height="120px" borderRadius="var(--radius-md)" />
        <Skeleton height="72px" borderRadius="var(--radius-md)" />
        <Skeleton height="72px" borderRadius="var(--radius-md)" />
      </div>
    )
  }

  if (!isProgramOn) {
    return (
      <EmptyState
        title={t.loyaltyTabDisabled}
        description={t.loyaltyTabDisabledDesc}
        action={
          <Link
            to={ROUTES.SETTINGS_LOYALTY}
            className="btn btn-primary btn-md"
            style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
          >
            {t.loyaltyTabGoToSettings}
          </Link>
        }
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <section>
        {balanceLoading && (
          <div
            aria-busy="true"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
          >
            <Skeleton height="120px" borderRadius="var(--radius-md)" />
          </div>
        )}

        {!balanceLoading && balanceError && (
          <ErrorState message={t.loyaltyLoadFailed} onRetry={refetch} />
        )}

        {!balanceLoading && !balanceError && balance && (
          <div className="loyalty-summary" role="group" aria-label={t.loyaltyTabSummaryHeader}>
            <SummaryCell
              label={t.loyaltyTabCurrent}
              value={`${formatPoints(balance.currentPoints)} ${t.loyaltyChipPoints}`}
            />
            <SummaryCell
              label={t.loyaltyTabLifetimeEarned}
              value={`${formatPoints(balance.lifetimeEarned)} ${t.loyaltyChipPoints}`}
            />
            <SummaryCell
              label={t.loyaltyTabLifetimeRedeemed}
              value={`${formatPoints(balance.lifetimeRedeemed)} ${t.loyaltyChipPoints}`}
            />
            <SummaryCell
              label={t.loyaltyTabExpiringSoon}
              value={`${formatPoints(balance.expiringSoonPoints)} ${t.loyaltyChipPoints}`}
              warn={balance.expiringSoonPoints > 0}
            />
          </div>
        )}
      </section>

      <section>
        <LoyaltyLedgerList partyId={partyId} enabled={isProgramOn} />
      </section>
    </div>
  )
}

function SummaryCell({
  label,
  value,
  warn,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div className="loyalty-summary__cell">
      <div className="loyalty-summary__label">{label}</div>
      <div className={`loyalty-summary__value${warn ? ' loyalty-summary__value--warn' : ''}`}>
        {value}
      </div>
    </div>
  )
}
