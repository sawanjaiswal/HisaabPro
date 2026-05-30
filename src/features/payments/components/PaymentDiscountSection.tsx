/** Payment Discount Section — shared between Record & Edit pages
 *
 * Toggle discount on/off, type (percentage/fixed), value input,
 * calculated amount display, reason field, and settlement summary.
 */

import { formatPaise } from '@/lib/format'
import { useLanguage } from '@/hooks/useLanguage'
import { PAYMENT_DISCOUNT_TYPE_LABELS } from '../payment.constants'
import type { PaymentFormDiscount, PaymentDiscountType } from '../payment.types'
import { Input } from '@/components/ui/Input'

interface Settlement {
  payment: number
  discount: number
  totalSettled: number
}

interface PaymentDiscountSectionProps {
  discount: PaymentFormDiscount | null
  amount: number
  settlement: Settlement
  errors: Record<string, string>
  onToggle: () => void
  onUpdate: <K extends keyof PaymentFormDiscount>(key: K, value: PaymentFormDiscount[K]) => void
}

const DISCOUNT_TYPES: PaymentDiscountType[] = ['PERCENTAGE', 'FIXED']

export function PaymentDiscountSection({
  discount,
  amount,
  settlement,
  errors,
  onToggle,
  onUpdate,
}: PaymentDiscountSectionProps) {
  const { t } = useLanguage()
  return (
    <div className="payment-form">
      <label className="payment-discount-toggle">
        <Input
          type="checkbox"
          checked={discount !== null}
          onChange={onToggle}
          aria-label={t.applyDiscountAria}
        />
        {t.applyDiscountLabel}
      </label>

      {discount !== null && (
        <div className="payment-discount-fields">
          {/* Discount type */}
          <div className="payment-field">
            <label className="label">{t.discountTypeLabel}</label>
            <div className="payment-discount-type" role="radiogroup" aria-label={t.discountTypeAria}>
              {DISCOUNT_TYPES.map((type) => (
                <label key={type} className="payment-radio-label">
                  <Input
                    type="radio"
                    name="discountType"
                    value={type}
                    checked={discount.type === type}
                    onChange={() => onUpdate('type', type)}
                    aria-label={PAYMENT_DISCOUNT_TYPE_LABELS[type]}
                  />
                  {PAYMENT_DISCOUNT_TYPE_LABELS[type]}
                </label>
              ))}
            </div>
          </div>

          {/* Discount value */}
          <div className="payment-field">
            <label className="label" htmlFor="discount-value">
              {discount.type === 'PERCENTAGE' ? t.percentageLabel : t.amountRupees}
            </label>
            <Input
              id="discount-value"
              type="number"
              inputMode="decimal"
              className="input"
              placeholder={discount.type === 'PERCENTAGE' ? '0' : '0.00'}
              value={discount.value > 0 ? discount.value : ''}
              onChange={(e) => onUpdate('value', parseFloat(e.target.value || '0'))}
              aria-label={t.discountValueAria}
            />
            {errors['discount.value'] && (
              <span className="field-error" role="alert">{errors['discount.value']}</span>
            )}
          </div>

          {/* Calculated discount */}
          {discount.calculatedAmount > 0 && (
            <p className="payment-discount-calc">
              {t.discountColon} {formatPaise(discount.calculatedAmount)}
            </p>
          )}

          {/* Reason */}
          <div className="payment-field">
            <label className="label" htmlFor="discount-reason">{t.reasonOptional}</label>
            <Input
              id="discount-reason"
              type="text"
              className="input"
              placeholder={t.discountReason}
              value={discount.reason}
              onChange={(e) => onUpdate('reason', e.target.value)}
              aria-label={t.discountReasonAria}
              maxLength={200}
            />
            {errors['discount.reason'] && (
              <span className="field-error" role="alert">{errors['discount.reason']}</span>
            )}
          </div>
        </div>
      )}

      {/* Settlement summary */}
      {amount > 0 && (
        <div className="payment-settlement-summary">
          <div className="payment-settlement-row">
            <span>{t.paymentWord}</span>
            <span>{formatPaise(settlement.payment)}</span>
          </div>
          {settlement.discount > 0 && (
            <div className="payment-settlement-row">
              <span>{t.discount}</span>
              <span>{formatPaise(settlement.discount)}</span>
            </div>
          )}
          <div className="payment-settlement-row payment-settlement-total">
            <span>{t.totalSettled}</span>
            <span>{formatPaise(settlement.totalSettled)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
