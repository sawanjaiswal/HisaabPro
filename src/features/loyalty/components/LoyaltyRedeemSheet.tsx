/**
 * Loyalty #125 — Redemption drawer.
 *
 * Opens from PaymentSheet when the cashier taps "Use loyalty points". Computes
 * BigInt-correct max redemption against (program rules × current balance ×
 * grand-total), exposes a "Max" shortcut, and yields the chosen (points,
 * paise) pair back to the caller via `onApply`.
 *
 * The caller is responsible for inserting the resulting payment split into
 * the POS cart — this drawer is pure UI.
 *
 * 4 UI states (Rule G):
 *   loading  → wait for program + balance (shows skeleton row)
 *   error    → in-drawer error message
 *   empty    → "no points yet" — disabled apply
 *   success  → input + apply CTA
 */

import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { formatPaise } from '@/lib/format'
import { useLoyaltyProgram } from '../hooks/useLoyaltyProgram'
import { useLoyaltyBalance } from '../hooks/useLoyaltyBalance'
import { maxRedeemPoints, pointsToPaise, formatPoints } from '../loyalty.utils'
import '@/styles/components.loyalty.css'

export interface LoyaltyRedeemResult {
  points: number
  paise: number
}

interface LoyaltyRedeemSheetProps {
  open: boolean
  partyId: string | undefined
  /** Bill total in paise — used to clamp redemption */
  grandTotalPaise: number
  /** Existing redemption if user re-opens drawer (paise of current split) */
  currentPoints?: number
  onClose: () => void
  onApply: (result: LoyaltyRedeemResult) => void
  /** Show "Remove" button when a redemption is already applied */
  onRemove?: () => void
}

export function LoyaltyRedeemSheet({
  open,
  partyId,
  grandTotalPaise,
  currentPoints = 0,
  onClose,
  onApply,
  onRemove,
}: LoyaltyRedeemSheetProps) {
  const { t } = useLanguage()
  const { program, isLoading: programLoading, isError: programError } = useLoyaltyProgram()
  const { balance, isLoading: balanceLoading, isError: balanceError, refetch } = useLoyaltyBalance({
    partyId,
    enabled: open && Boolean(partyId) && Boolean(program?.enabled),
  })

  // Local input — points entered by the cashier.
  const [pointsInput, setPointsInput] = useState<string>('')

  // Reset input each time the drawer opens.
  useEffect(() => {
    if (!open) return
    setPointsInput(currentPoints > 0 ? String(currentPoints) : '')
  }, [open, currentPoints])

  const maxAllowed = useMemo(() => {
    if (!program || !balance) return 0
    return maxRedeemPoints(grandTotalPaise, balance.currentPoints, program)
  }, [program, balance, grandTotalPaise])

  const pointsValue = useMemo(() => {
    const n = Number(pointsInput)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  }, [pointsInput])

  const discountPaise = useMemo(() => {
    if (!program || pointsValue <= 0) return 0
    return pointsToPaise(pointsValue, program)
  }, [program, pointsValue])

  // Validation
  const errorKey: keyof typeof t | null = (() => {
    if (!program?.enabled) return 'loyaltyRedeemNoProgram'
    if (!partyId) return 'loyaltyRedeemRequiresParty'
    if (pointsValue <= 0) return null
    if (balance && pointsValue > balance.currentPoints) return 'loyaltyRedeemExceedsBalance'
    if (discountPaise > grandTotalPaise) return 'loyaltyRedeemExceedsBill'
    if (program.redemptionUnit > 1 && pointsValue % program.redemptionUnit !== 0) {
      return null // hint already explains multiples; we'll snap on Max
    }
    return null
  })()

  const isApplyDisabled =
    pointsValue <= 0 ||
    pointsValue > maxAllowed ||
    discountPaise <= 0 ||
    discountPaise > grandTotalPaise

  const handleApply = () => {
    if (isApplyDisabled) return
    onApply({ points: pointsValue, paise: discountPaise })
    onClose()
  }

  const handleMax = () => {
    setPointsInput(String(maxAllowed))
  }

  const handleRemove = () => {
    if (!onRemove) return
    onRemove()
    onClose()
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <Drawer open={open} onClose={onClose} title={t.loyaltyRedeemTitle} size="sm">
      <div className="loyalty-redeem">
        {(programLoading || balanceLoading) && (
          <>
            <Skeleton height="48px" borderRadius="var(--radius-md)" />
            <Skeleton height="48px" borderRadius="var(--radius-md)" />
            <Skeleton height="48px" borderRadius="var(--radius-md)" />
          </>
        )}

        {!programLoading && (programError) && (
          <ErrorState message={t.loyaltyLoadFailed} onRetry={refetch} />
        )}

        {!programLoading && !programError && !program?.enabled && (
          <EmptyState
            title={t.loyaltyRedeemNoProgram}
            description={t.loyaltyTabDisabledDesc}
          />
        )}

        {!programLoading && program?.enabled && !partyId && (
          <EmptyState title={t.loyaltyRedeemRequiresParty} />
        )}

        {!programLoading && program?.enabled && partyId && (balanceError) && (
          <ErrorState message={t.loyaltyLoadFailed} onRetry={refetch} />
        )}

        {!programLoading && program?.enabled && partyId && !balanceLoading && balance && (
          <>
            <div className="loyalty-redeem__row">
              <span className="loyalty-redeem__label">{t.loyaltyRedeemBalance}</span>
              <span className="loyalty-redeem__value">
                {formatPoints(balance.currentPoints)} {t.loyaltyChipPoints}
              </span>
            </div>

            <div className="loyalty-redeem__row">
              <span className="loyalty-redeem__label">{t.loyaltyRedeemBillTotal}</span>
              <span className="loyalty-redeem__value">{formatPaise(grandTotalPaise)}</span>
            </div>

            <div className="loyalty-redeem__field">
              <label className="loyalty-redeem__label" htmlFor="loyalty-points-input">
                {t.loyaltyRedeemPointsLabel}
              </label>
              <div className="loyalty-redeem__input-row">
                <Input
                  id="loyalty-points-input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={program.redemptionUnit || 1}
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault()
                  }}
                />
                <button
                  type="button"
                  className="loyalty-redeem__max-btn"
                  onClick={handleMax}
                  disabled={maxAllowed <= 0}
                >
                  {t.loyaltyRedeemMax}
                </button>
              </div>
              {program.redemptionUnit > 1 && (
                <p className="loyalty-redeem__hint">
                  {t.loyaltyRedeemUnitHint.replace('{unit}', String(program.redemptionUnit))}
                </p>
              )}
              {errorKey && (
                <p className="loyalty-redeem__error" role="alert">
                  {t[errorKey]}
                </p>
              )}
            </div>

            <div className="loyalty-redeem__row">
              <span className="loyalty-redeem__label">{t.loyaltyRedeemDiscountLabel}</span>
              <span className="loyalty-redeem__value loyalty-redeem__value--discount">
                {formatPaise(discountPaise)}
              </span>
            </div>

            <div className="loyalty-redeem__footer">
              {currentPoints > 0 && onRemove && (
                <Button variant="ghost" onClick={handleRemove}>
                  {t.loyaltyRedeemRemove}
                </Button>
              )}
              <Button variant="ghost" onClick={onClose}>
                {t.loyaltyRedeemCancel}
              </Button>
              <Button variant="primary" onClick={handleApply} disabled={isApplyDisabled}>
                {t.loyaltyRedeemApply}
              </Button>
            </div>
          </>
        )}
      </div>
    </Drawer>
  )
}
