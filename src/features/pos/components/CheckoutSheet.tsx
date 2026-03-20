/** POS Checkout — Bottom sheet with payment mode + confirm */

import { useState, useMemo } from 'react'
import { Banknote, Smartphone, CreditCard } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { formatPaise } from '@/lib/format'
import { cartSubtotal } from '../pos.utils'
import { PAYMENT_MODES } from '../pos.constants'

import type { PosCartItem, PaymentMode } from '../pos.types'

const ICONS = { Banknote, Smartphone, CreditCard } as const

interface CheckoutSheetProps {
  open: boolean
  onClose: () => void
  items: PosCartItem[]
  isProcessing: boolean
  onConfirm: (mode: PaymentMode, amountPaid: number) => void
}

export function CheckoutSheet({ open, onClose, items, isProcessing, onConfirm }: CheckoutSheetProps) {
  const [mode, setMode] = useState<PaymentMode>('cash')
  const total = useMemo(() => cartSubtotal(items), [items])

  const handleConfirm = () => {
    onConfirm(mode, total)
  }

  return (
    <Drawer open={open} onClose={onClose} title="Payment" size="sm">
      <div className="pos-checkout-body">
        <div className="pos-checkout-total">
          <span className="pos-checkout-total-label">Total</span>
          <span className="pos-checkout-total-value">{formatPaise(total)}</span>
        </div>

        <fieldset className="pos-payment-modes" aria-label="Payment method">
          <legend className="pos-payment-legend">Payment Method</legend>
          <div className="pos-payment-grid">
            {PAYMENT_MODES.map(({ value, label, icon }) => {
              const Icon = ICONS[icon as keyof typeof ICONS]
              const isActive = mode === value
              return (
                <button
                  key={value}
                  type="button"
                  className={`pos-payment-btn ${isActive ? 'pos-payment-btn--active' : ''}`}
                  onClick={() => setMode(value)}
                  aria-pressed={isActive}
                >
                  <Icon size={22} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <button
          type="button"
          className="btn btn-primary pos-confirm-btn"
          onClick={handleConfirm}
          disabled={isProcessing || items.length === 0}
          aria-label={isProcessing ? 'Processing sale...' : `Confirm ${formatPaise(total)} ${mode} payment`}
        >
          {isProcessing ? 'Processing...' : `Confirm ${formatPaise(total)}`}
        </button>
      </div>
    </Drawer>
  )
}
