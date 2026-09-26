/** Payment Mode Selector & Quick Amount Chips
 *
 * Extracted sub-component for RecordDocumentPaymentSheet to adhere to Level 6 line budget.
 */

import React from 'react'
import { Button } from '@/components/ui/Button'
import { formatPaise } from '@/lib/format'
import type { PaymentMode } from '../payment.types'
import { Banknote, QrCode, Building2, FileCheck } from 'lucide-react'

interface Props {
  mode: PaymentMode
  onSelectMode: (mode: PaymentMode) => void
  balanceDue: number
  onSetAmount: (rupees: string) => void
}

const PAYMENT_MODES: Array<{ mode: PaymentMode; label: string; icon: React.ComponentType<{ size: number }> }> = [
  { mode: 'CASH', label: 'Cash', icon: Banknote },
  { mode: 'UPI', label: 'UPI / QR', icon: QrCode },
  { mode: 'BANK_TRANSFER', label: 'Bank', icon: Building2 },
  { mode: 'CHEQUE', label: 'Cheque', icon: FileCheck },
]

export function PaymentModeSelector({
  mode,
  onSelectMode,
  balanceDue,
  onSetAmount,
}: Props) {
  return (
    <div className="space-y-3">
      {/* Quick Amount Chips */}
      {balanceDue > 0 && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="none"
            className="text-xs px-2.5 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)] font-medium"
            onClick={() => onSetAmount((balanceDue / 100).toString())}
          >
            Full Balance ({formatPaise(balanceDue)})
          </Button>
          {balanceDue >= 200 && (
            <Button
              type="button"
              variant="none"
              className="text-xs px-2.5 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)] font-medium"
              onClick={() => onSetAmount(Math.round(balanceDue / 200).toString())}
            >
              50% ({formatPaise(Math.round(balanceDue / 2))})
            </Button>
          )}
        </div>
      )}

      {/* Mode Grid */}
      <div>
        <label className="input-label">Payment Mode</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PAYMENT_MODES.map((item) => {
            const isSelected = mode === item.mode
            const Icon = item.icon
            return (
              <button
                key={item.mode}
                type="button"
                onClick={() => onSelectMode(item.mode)}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#026F39] bg-[#026F39]/10 text-[#026F39] font-bold shadow-sm'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]'
                }`}
              >
                <Icon size={20} />
                <span className="text-xs mt-1">{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
