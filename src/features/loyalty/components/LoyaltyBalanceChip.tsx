/**
 * Loyalty #125 — Inline points chip.
 *
 * Mounted next to the selected party (POS CustomerSelector, PaymentSheet
 * header). Hides itself when the program is disabled OR there is no party
 * (walk-in) so callers don't need their own conditionals.
 *
 * 4 UI states (Rule G):
 *   loading  → shimmer chip
 *   error    → render null (silent — chip is supplementary, not load-bearing)
 *   empty    → "No points yet" muted variant
 *   success  → ★ points · expiring-soon badge if applicable
 */

import { Sparkles, Clock } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { useLoyaltyProgram } from '../hooks/useLoyaltyProgram'
import { useLoyaltyBalance } from '../hooks/useLoyaltyBalance'
import { formatPoints } from '../loyalty.utils'
import '@/styles/components.loyalty.css'

interface LoyaltyBalanceChipProps {
  partyId: string | undefined
  /** Show the "expiring soon" sub-badge when balance includes near-expiry points */
  showExpiringHint?: boolean
  /** Tiny visual variant (used in POS header where space is tight) */
  size?: 'sm' | 'md'
  className?: string
}

export function LoyaltyBalanceChip({
  partyId,
  showExpiringHint = true,
  className = '',
}: LoyaltyBalanceChipProps) {
  const { t } = useLanguage()
  const { program, isLoading: programLoading } = useLoyaltyProgram()

  const enabled = Boolean(program?.enabled) && Boolean(partyId)
  const { balance, isLoading, isError } = useLoyaltyBalance({
    partyId,
    enabled,
  })

  // Program off / walk-in / load error → render nothing.
  if (programLoading) return null
  if (!program?.enabled) return null
  if (!partyId) return null
  if (isError) return null

  if (isLoading || !balance) {
    return (
      <span
        className={`loyalty-chip loyalty-chip--loading skeleton ${className}`}
        aria-label={t.loyaltyChipLoading}
      />
    )
  }

  const { currentPoints, expiringSoonPoints, expiringSoonDays } = balance

  if (currentPoints <= 0) {
    return (
      <span className={`loyalty-chip loyalty-chip--empty ${className}`}>
        <span className="loyalty-chip__icon"><Sparkles size={14} aria-hidden="true" /></span>
        {t.loyaltyChipNoBalance}
      </span>
    )
  }

  return (
    <span className={`loyalty-chip ${className}`} aria-live="polite">
      <span className="loyalty-chip__icon"><Sparkles size={14} aria-hidden="true" /></span>
      <span className="loyalty-chip__points">{formatPoints(currentPoints)}</span>
      <span className="loyalty-chip__suffix">{t.loyaltyChipPoints}</span>

      {showExpiringHint && expiringSoonPoints > 0 && (
        <span
          className="loyalty-chip__expiring"
          title={t.loyaltyChipExpiringWindow.replace('{days}', String(expiringSoonDays))}
        >
          <Clock size={12} aria-hidden="true" />
          {formatPoints(expiringSoonPoints)} {t.loyaltyChipExpiringSoon}
        </span>
      )}
    </span>
  )
}
