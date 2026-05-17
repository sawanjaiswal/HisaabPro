/**
 * Loyalty #125 — Per-party ledger list (infinite scroll).
 *
 * Mounted inside PartyDetailLoyaltyTab. Renders the 6 ledger entry types
 * with semantic tone (positive/negative/neutral) and respects the program's
 * expiry policy (shows "Expires <date>" / "No expiry" per row).
 *
 * 4 UI states (Rule G): loading skeleton · error retry · empty · success.
 */

import {
  Plus,
  Minus,
  Clock,
  Edit3,
  XCircle,
  RotateCcw,
  History,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/feedback/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { useLoyaltyLedger } from '../hooks/useLoyaltyLedger'
import { formatPoints } from '../loyalty.utils'
import {
  LOYALTY_LEDGER_TYPE_LABEL_KEY,
  LOYALTY_LEDGER_TYPE_TONE,
} from '../loyalty.constants'
import type { LoyaltyLedgerRowDTO, LoyaltyLedgerType } from '../loyalty.types'
import '@/styles/components.loyalty.css'

interface LoyaltyLedgerListProps {
  partyId: string | undefined
  enabled?: boolean
}

const ICON_MAP: Record<LoyaltyLedgerType, LucideIcon> = {
  AC: Plus,
  RD: Minus,
  EX: Clock,
  AD: Edit3,
  VD: XCircle,
  VR: RotateCcw,
}

export function LoyaltyLedgerList({ partyId, enabled = true }: LoyaltyLedgerListProps) {
  const { t } = useLanguage()
  const {
    rows,
    status,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refresh,
  } = useLoyaltyLedger({ partyId, enabled })

  if (status === 'loading') {
    return (
      <div className="loyalty-ledger">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height="72px" borderRadius="var(--radius-md)" />
        ))}
      </div>
    )
  }

  if (status === 'error') {
    return <ErrorState message={t.loyaltyLedgerError} onRetry={refresh} />
  }

  if (status === 'success' && rows.length === 0) {
    return (
      <EmptyState
        icon={<History size={22} aria-hidden="true" />}
        title={t.loyaltyLedgerEmpty}
        description={t.loyaltyLedgerEmptyDesc}
      />
    )
  }

  return (
    <div className="loyalty-ledger">
      {rows.map((row) => (
        <LedgerRow key={row.id} row={row} />
      ))}
      {hasNextPage && (
        <Button
          className="loyalty-ledger__load-more"
          variant="secondary"
          size="sm"
          loading={isFetchingNextPage}
          onClick={fetchNextPage}
        >
          {t.loyaltyLedgerLoadMore}
        </Button>
      )}
    </div>
  )
}

function LedgerRow({ row }: { row: LoyaltyLedgerRowDTO }) {
  const { t } = useLanguage()
  const Icon = ICON_MAP[row.type]
  const tone = LOYALTY_LEDGER_TYPE_TONE[row.type]
  const labelKey = LOYALTY_LEDGER_TYPE_LABEL_KEY[row.type] as keyof typeof t
  const label = t[labelKey] ?? row.type

  const sign = row.delta > 0 ? '+' : row.delta < 0 ? '−' : ''
  const magnitude = Math.abs(row.delta)

  const expiresLabel =
    row.expiresAt
      ? t.loyaltyLedgerExpiresOn.replace('{date}', formatDate(row.expiresAt))
      : t.loyaltyLedgerNeverExpires

  return (
    <div className="loyalty-ledger__row">
      <span className={`loyalty-ledger__icon loyalty-ledger__icon--${tone}`}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="loyalty-ledger__body">
        <div className="loyalty-ledger__top">
          <span className="loyalty-ledger__type">{label}</span>
          <span className={`loyalty-ledger__delta loyalty-ledger__delta--${tone}`}>
            {sign}{formatPoints(magnitude)} {t.loyaltyChipPoints}
          </span>
        </div>
        <div className="loyalty-ledger__meta">
          {formatRelativeTime(row.createdAt)} · {expiresLabel}
        </div>
        {row.note && (
          <p className="loyalty-ledger__note">
            <strong>{t.loyaltyLedgerNotePrefix}:</strong> {row.note}
          </p>
        )}
      </div>
    </div>
  )
}
