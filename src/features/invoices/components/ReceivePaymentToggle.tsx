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
import { IndianRupee, Banknote, Smartphone, Building2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Text } from '@/components/ui/Text'
import { Heading } from '@/components/ui/Heading'
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
    <section className="receive-payment-card" aria-label={t.receivePaymentTitle}>
      <header className="receive-payment-head">
        <span className="receive-payment-icon" aria-hidden="true">
          <IndianRupee size={18} />
        </span>
        <div className="receive-payment-titles">
          <Heading level={3} className="receive-payment-title">{t.receivePaymentTitle}</Heading>
          <Text className="receive-payment-subtitle">{t.receivePaymentSubtitle}</Text>
        </div>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={setFull}
          className="border-[var(--color-primary-600)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] text-xs font-bold rounded-xl px-3 py-1.5 transition-colors cursor-pointer"
        >
          {t.receiveFull || 'Full'} ({formatRupees(grandTotal)})
        </Button>
      </header>

      <div className="receive-payment-amount-row">
        <div className="receive-payment-input-wrap">
          <span className="receive-payment-currency-sym" aria-hidden="true">₹</span>
          <Input
            type="number"
            inputMode="decimal"
            value={raw}
            onChange={(e) => applyRupees(e.target.value)}
            onKeyDown={(e) => {
              if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault()
            }}
            placeholder="0.00"
            aria-label={t.amountReceivedLabel}
            min={0}
            className="bg-transparent border-0 text-xl font-bold p-0 shadow-none focus-visible:ring-0"
          />
        </div>
        {received > 0 && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={clear}
            className="text-[var(--color-gray-500)] hover:text-[var(--color-error-600)] text-xs font-semibold px-2 py-1 cursor-pointer"
          >
            {t.receiveClear || 'Clear'}
          </Button>
        )}
      </div>

      {received > 0 && (
        <div className="receive-payment-modes" role="group" aria-label={t.amountReceivedLabel}>
          {QUICK_MODES.map(({ value, icon: Icon, labelKey }) => (
            <Button
              variant="none"
              key={value}
              type="button"
              className={`receive-payment-mode-btn ${payment.mode === value ? 'active' : ''}`}
              aria-pressed={payment.mode === value}
              onClick={() => onChange({ ...payment, mode: value })}
            >
              <Icon size={14} aria-hidden="true" />
              <span>{t[labelKey]}</span>
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
          className="bg-[var(--color-gray-50)] rounded-xl text-xs font-medium min-h-[40px]"
        />
      )}

      {received > 0 && (
        <div className="receive-payment-balance">
          {balance > 0 ? (
            <>
              <span className="font-medium text-[var(--color-text-secondary)]">{t.balanceRemaining}</span>
              <span className="receive-payment-balance-value tabular-nums text-sm text-[var(--color-warning-700)]">
                {formatRupees(balance)}
              </span>
            </>
          ) : balance < 0 ? (
            <>
              <span className="font-medium text-[var(--color-text-secondary)]">{t.changeToReturn}</span>
              <span className="receive-payment-balance-value tabular-nums text-sm text-[var(--color-success-700)]">
                {formatRupees(-balance)}
              </span>
            </>
          ) : (
            <span className="receive-payment-paid">
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>{t.fullyPaidNote || 'Fully Paid'}</span>
            </span>
          )}
        </div>
      )}
    </section>
  )
}
