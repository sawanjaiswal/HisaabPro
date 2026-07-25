/** Receive-Payment Toggle — record money collected at invoice creation.
 *
 * Gold-standard "sell in one shot": the seller enters how much the customer
 * paid now (cash/UPI/bank) right on the create screen. The amount lands in
 * `form.payment` (paise); the create call site forwards it and the server
 * records a real Payment + allocation via the canonical createPayment service.
 * Purely controlled — the parent owns `form.payment` and only mounts this for a
 * SALE_INVOICE with a non-zero total.
 */

import { useState } from 'react'
import { IndianRupee, Banknote, Smartphone, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/hooks/useLanguage'
import { formatRupees } from '@/lib/format'
import type { InvoicePaymentFormData, PaymentModeValue } from '../invoice-api.types'
import './receive-payment-toggle.css'

interface ReceivePaymentToggleProps {
  /** Invoice grand total in paise — drives Full quick-fill + balance line. */
  grandTotal: number
  payment: InvoicePaymentFormData
  onChange: (next: InvoicePaymentFormData) => void
}

/** The three modes an Indian MSME reaches for first; OTHER stays on the
 *  Payments screen where the full set + reference handling lives. */
const QUICK_MODES: ReadonlyArray<{
  value: PaymentModeValue
  icon: typeof Banknote
  labelKey: 'payModeCash' | 'payModeUpi' | 'payModeBank'
}> = [
  { value: 'CASH', icon: Banknote, labelKey: 'payModeCash' },
  { value: 'UPI', icon: Smartphone, labelKey: 'payModeUpi' },
  { value: 'BANK_TRANSFER', icon: Building2, labelKey: 'payModeBank' },
]

export function ReceivePaymentToggle({ grandTotal, payment, onChange }: ReceivePaymentToggleProps) {
  const { t } = useLanguage()
  // Local string so decimals (e.g. "125.50") type cleanly; paise is derived.
  const [raw, setRaw] = useState(
    payment.amountReceived > 0 ? String(payment.amountReceived / 100) : '',
  )

  const received = payment.amountReceived
  const balance = grandTotal - received

  const applyRupees = (str: string) => {
    setRaw(str)
    const rupees = Number(str)
    const paise = Number.isFinite(rupees) && rupees > 0 ? Math.round(rupees * 100) : 0
    onChange({ ...payment, amountReceived: paise })
  }

  const setFull = () => applyRupees(String(grandTotal / 100))
  const clear = () => applyRupees('')
  const showReference = payment.mode !== 'CASH' && received > 0

  return (
    <section className="receive-payment" aria-label={t.receivePaymentTitle}>
      <header className="receive-payment-head">
        <span className="receive-payment-icon" aria-hidden="true">
          <IndianRupee size={16} />
        </span>
        <div className="receive-payment-titles">
          <h3 className="receive-payment-title">{t.receivePaymentTitle}</h3>
          {received === 0 && (
            <p className="receive-payment-subtitle">{t.receivePaymentSubtitle}</p>
          )}
        </div>
        <Button variant="outline" size="sm" type="button" onClick={setFull}>
          {t.receiveFull}
        </Button>
      </header>

      <div className="receive-payment-amount-row">
        <Input
          type="number"
          inputMode="decimal"
          className="receive-payment-input"
          icon={<IndianRupee size={16} />}
          value={raw}
          onChange={(e) => applyRupees(e.target.value)}
          onKeyDown={(e) => {
            if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault()
          }}
          placeholder="0"
          aria-label={t.amountReceivedLabel}
          min={0}
        />
        {received > 0 && (
          <Button variant="ghost" size="sm" type="button" onClick={clear}>
            {t.receiveClear}
          </Button>
        )}
      </div>

      {received > 0 && (
        <div className="receive-payment-modes" role="group" aria-label={t.amountReceivedLabel}>
          {QUICK_MODES.map(({ value, icon: Icon, labelKey }) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={payment.mode === value ? 'primary' : 'outline'}
              className="receive-payment-mode"
              aria-pressed={payment.mode === value}
              onClick={() => onChange({ ...payment, mode: value })}
            >
              <Icon size={14} aria-hidden="true" />
              {t[labelKey]}
            </Button>
          ))}
        </div>
      )}

      {showReference && (
        <Input
          type="text"
          value={payment.referenceNumber}
          onChange={(e) => onChange({ ...payment, referenceNumber: e.target.value })}
          placeholder={t.paymentRefPlaceholder}
          aria-label={t.paymentRefPlaceholder}
          maxLength={100}
        />
      )}

      {received > 0 && (
        <div className="receive-payment-balance">
          {balance > 0 ? (
            <>
              <span>{t.balanceRemaining}</span>
              <span className="receive-payment-balance-value tabular-nums">{formatRupees(balance)}</span>
            </>
          ) : balance < 0 ? (
            <>
              <span>{t.changeToReturn}</span>
              <span className="receive-payment-balance-value tabular-nums">{formatRupees(-balance)}</span>
            </>
          ) : (
            <span className="receive-payment-paid">{t.fullyPaidNote}</span>
          )}
        </div>
      )}
    </section>
  )
}
