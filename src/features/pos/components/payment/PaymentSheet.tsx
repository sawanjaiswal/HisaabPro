/** POS — Bottom sheet with mode buttons + split tender */

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { X, Plus, Sparkles } from 'lucide-react'
import { PaymentModeButton } from './PaymentModeButton'
import { SplitTenderRow } from './SplitTenderRow'
import { UpiQrModal } from './UpiQrModal'
import { usePosStore } from '../../state/pos.store'
import { useLanguage } from '@/hooks/useLanguage'
import { paiseToInr } from '../../utils/pos.format'
import { splitTotal } from '../../utils/pos.utils'
import { PAYMENT_MODES } from '../../utils/pos.constants'
import type { PaymentMode, PaymentSplit } from '../../types/pos.types'
import { LoyaltyBalanceChip } from '@/features/loyalty/components/LoyaltyBalanceChip'
import { LoyaltyRedeemSheet } from '@/features/loyalty/components/LoyaltyRedeemSheet'
import { useLoyaltyProgram } from '@/features/loyalty/hooks/useLoyaltyProgram'

interface PaymentSheetProps {
  open:            boolean
  isProcessing:    boolean
  grandTotal:      number
  onConfirm:       () => void
  onClose:         () => void
}

export function PaymentSheet({
  open,
  isProcessing,
  grandTotal,
  onConfirm,
  onClose,
}: PaymentSheetProps) {
  const { t }  = useLanguage()
  const store  = usePosStore()
  const [showQr, setShowQr] = useState(false)
  const [showLoyalty, setShowLoyalty] = useState(false)
  const { program: loyaltyProgram } = useLoyaltyProgram()
  const isLoyaltyOn = Boolean(loyaltyProgram?.enabled) && Boolean(store.partyId)

  // Default to single CASH split matching grand total
  const payments = store.payments.length > 0
    ? store.payments
    : [{ mode: 'CASH' as PaymentMode, amount: grandTotal }]

  const paid      = splitTotal(payments)
  const change    = paid - grandTotal
  const isValid   = paid >= grandTotal && payments.every((p) => p.amount > 0)

  const setPayments = store.setPayments

  const handleModeSelect = useCallback((mode: PaymentMode) => {
    // Single-mode: replace all splits with this mode
    setPayments([{ mode, amount: grandTotal }])
    if (mode === 'UPI') setShowQr(true)
  }, [grandTotal, setPayments])

  const handleAddSplit = () => {
    const usedModes = new Set(payments.map((p) => p.mode))
    const nextMode  = PAYMENT_MODES.find((m) => !usedModes.has(m.value))
    if (!nextMode) return
    setPayments([...payments, { mode: nextMode.value, amount: 0 }])
  }

  const handleSplitAmount = (index: number, paise: number) => {
    const updated = payments.map((p, i) => i === index ? { ...p, amount: paise } : p)
    setPayments(updated)
  }

  const handleSplitRemove = (index: number) => {
    const updated = payments.filter((_, i) => i !== index)
    setPayments(updated.length ? updated : [{ mode: 'CASH', amount: grandTotal }])
  }

  // Existing loyalty split (if any) — caller can pre-load the input.
  const loyaltySplit = payments.find((p) => p.mode === 'LOYALTY_REDEMPTION')
  const handleApplyLoyalty = ({ points, paise }: { points: number; paise: number }) => {
    // Drop any prior loyalty split, then shrink non-loyalty splits to make
    // room. Simplest correct strategy: replace cart payments with one loyalty
    // split + one CASH split for the remainder.
    const remainder = Math.max(0, grandTotal - paise)
    const next: PaymentSplit[] = [
      { mode: 'LOYALTY_REDEMPTION', amount: paise, pointsRedeemed: points },
    ]
    if (remainder > 0) next.push({ mode: 'CASH', amount: remainder })
    setPayments(next)
  }
  const handleRemoveLoyalty = () => {
    const cleaned = payments.filter((p) => p.mode !== 'LOYALTY_REDEMPTION')
    setPayments(cleaned.length ? cleaned : [{ mode: 'CASH', amount: grandTotal }])
  }

  if (!open) return null

  const primaryMode = payments[0]?.mode ?? 'CASH'
  const isSplit     = payments.length > 1

  return (
    <>
      <div
        className="pos-sheet-backdrop"
        onClick={onClose}
        role="presentation"
        aria-hidden="true"
      />
      <div
        className="pos-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t.posPaymentTitle ?? 'Payment'}
      >
        <div className="pos-sheet__header">
          <h2 className="pos-sheet__title">{t.posPaymentTitle ?? 'Payment'}</h2>
          <Button variant="none" type="button" className="pos-sheet__close" onClick={onClose} aria-label={t.close ?? 'Close'}>
            <X size={18} aria-hidden="true" />
          </Button>
        </div>

        <div className="pos-sheet__body">
          <p className="pos-sheet__total-label">{t.posGrandTotal ?? 'Total'}</p>
          <p className="pos-sheet__total-amount">{paiseToInr(grandTotal)}</p>

          {/* Loyalty chip + CTA — hidden when program off / walk-in */}
          {isLoyaltyOn && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
                margin: 'var(--space-2) 0 var(--space-3)',
                flexWrap: 'wrap',
              }}
            >
              <LoyaltyBalanceChip partyId={store.partyId} />
              <Button
                type="button"
                onClick={() => setShowLoyalty(true)}
                variant="secondary" size="sm"
                style={{ minHeight: 36, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Sparkles size={14} aria-hidden="true" />
                {t.loyaltyRedeemUsePoints}
              </Button>
            </div>
          )}

          {/* Mode selector */}
          <div
            className="pos-modes"
            role="radiogroup"
            aria-label={t.posSelectMode ?? 'Select payment mode'}
          >
            {PAYMENT_MODES.map((m) => (
              <PaymentModeButton
                key={m.value}
                mode={m.value}
                labelKey={m.labelKey}
                iconName={m.icon}
                isSelected={!isSplit && primaryMode === m.value}
                onSelect={handleModeSelect}
              />
            ))}
          </div>

          {/* Split tender rows */}
          {isSplit && (
            <div className="pos-split-list">
              {payments.map((split, i) => (
                <SplitTenderRow
                  key={i}
                  split={split}
                  index={i}
                  onAmountChange={handleSplitAmount}
                  onRemove={handleSplitRemove}
                  canRemove={payments.length > 1}
                />
              ))}
            </div>
          )}

          {/* Add split */}
          {payments.length < PAYMENT_MODES.length && (
            <Button variant="none"
              type="button"
              className="pos-split-add-btn"
              onClick={handleAddSplit}
            >
              <Plus size={13} aria-hidden="true" />
              {t.posSplitPayment ?? 'Split payment'}
            </Button>
          )}

          {/* Change */}
          {change > 0 && (
            <p className="pos-sheet__change">
              {t.posChange ?? 'Change'}: <strong>{paiseToInr(change)}</strong>
            </p>
          )}
        </div>

        <div className="pos-sheet__footer">
          <Button variant="none"
            type="button"
            className="pos-sheet__confirm-btn"
            disabled={!isValid || isProcessing}
            onClick={onConfirm}
            aria-busy={isProcessing}
          >
            {isProcessing
              ? (t.posProcessing ?? 'Processing…')
              : (t.posConfirmSale ?? 'Confirm sale')}
          </Button>
        </div>
      </div>

      {showQr && (
        <UpiQrModal
          amountPaise={grandTotal}
          onClose={() => setShowQr(false)}
        />
      )}

      <LoyaltyRedeemSheet
        open={showLoyalty}
        partyId={store.partyId}
        grandTotalPaise={grandTotal}
        currentPoints={loyaltySplit?.pointsRedeemed ?? 0}
        onClose={() => setShowLoyalty(false)}
        onApply={handleApplyLoyalty}
        onRemove={loyaltySplit ? handleRemoveLoyalty : undefined}
      />
    </>
  )
}
