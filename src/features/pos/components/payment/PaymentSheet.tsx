/** POS — Bottom sheet with mode buttons + split tender */

import { useState, useCallback } from 'react'
import { X, Plus } from 'lucide-react'
import { PaymentModeButton } from './PaymentModeButton'
import { SplitTenderRow } from './SplitTenderRow'
import { UpiQrModal } from './UpiQrModal'
import { usePosStore } from '../../state/pos.store'
import { useLanguage } from '@/hooks/useLanguage'
import { paiseToInr } from '../../utils/pos.format'
import { splitTotal } from '../../utils/pos.utils'
import { PAYMENT_MODES } from '../../utils/pos.constants'
import type { PaymentMode } from '../../types/pos.types'

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
          <button type="button" className="pos-sheet__close" onClick={onClose} aria-label={t.close ?? 'Close'}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="pos-sheet__body">
          <p className="pos-sheet__total-label">{t.posGrandTotal ?? 'Total'}</p>
          <p className="pos-sheet__total-amount">{paiseToInr(grandTotal)}</p>

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
            <button
              type="button"
              className="pos-split-add-btn"
              onClick={handleAddSplit}
            >
              <Plus size={13} aria-hidden="true" />
              {t.posSplitPayment ?? 'Split payment'}
            </button>
          )}

          {/* Change */}
          {change > 0 && (
            <p className="pos-sheet__change">
              {t.posChange ?? 'Change'}: <strong>{paiseToInr(change)}</strong>
            </p>
          )}
        </div>

        <div className="pos-sheet__footer">
          <button
            type="button"
            className="pos-sheet__confirm-btn"
            disabled={!isValid || isProcessing}
            onClick={onConfirm}
            aria-busy={isProcessing}
          >
            {isProcessing
              ? (t.posProcessing ?? 'Processing…')
              : (t.posConfirmSale ?? 'Confirm sale')}
          </button>
        </div>
      </div>

      {showQr && (
        <UpiQrModal
          amountPaise={grandTotal}
          onClose={() => setShowQr(false)}
        />
      )}
    </>
  )
}
