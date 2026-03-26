/** POS Checkout — Bottom sheet with payment mode + confirm */

import { useState, useMemo } from 'react'
import { Banknote, Smartphone, CreditCard } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { formatPaise } from '@/lib/format'
import { useLanguage } from '@/hooks/useLanguage'
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
  const { t } = useLanguage()
  const [mode, setMode] = useState<PaymentMode>('cash')
  const total = useMemo(() => cartSubtotal(items), [items])

  const handleConfirm = () => {
    onConfirm(mode, total)
  }

  return (
    <Drawer open={open} onClose={onClose} title={t.payments} size="sm">
      <div className="pos-checkout-body">
        <div className="pos-checkout-total">
          <span className="pos-checkout-total-label">{t.total}</span>
          <span className="pos-checkout-total-value">{formatPaise(total)}</span>
        </div>

        <fieldset className="pos-payment-modes" aria-label={t.posPaymentMethod}>
          <legend className="pos-payment-legend">{t.posPaymentMethod}</legend>
          <div className="pos-payment-grid">
            {PAYMENT_MODES.map(({ value, labelKey, icon }) => {
              const Icon = ICONS[icon as keyof typeof ICONS]
              const isActive = mode === value
              const label = t[labelKey as keyof typeof t] as string
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

        <Button
          variant="primary"
          size="lg"
          className="pos-confirm-btn"
          onClick={handleConfirm}
          disabled={items.length === 0}
          loading={isProcessing}
          aria-label={isProcessing ? t.posProcessingSale : `${t.posConfirm} ${formatPaise(total)} ${mode}`}
        >
          {`${t.posConfirm} ${formatPaise(total)}`}
        </Button>
      </div>
    </Drawer>
  )
}
