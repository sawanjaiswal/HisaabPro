/**
 * CouponForm — Create / edit coupon form
 * Feature #96
 */

import { useState, useRef } from 'react'
import type { CreateCouponInput, DiscountType, CouponAppliesTo } from '../coupon.types'
import { CODE_MIN_LENGTH, CODE_MAX_LENGTH, CODE_PATTERN, MAX_PERCENTAGE_BASIS_POINTS, PERCENTAGE_CAP_MSG, DISCOUNT_TYPE_LABELS, APPLIES_TO_LABELS } from '../coupon.constants'
import '../coupon.css'
import { useLanguage } from '@/hooks/useLanguage'

interface CouponFormProps {
  onSubmit: (data: CreateCouponInput) => Promise<unknown>
  onCancel: () => void
}

export function CouponForm({ onSubmit, onCancel }: CouponFormProps) {
  const { t } = useLanguage()
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [maxUsesPerUser, setMaxUsesPerUser] = useState('1')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [appliesTo, setAppliesTo] = useState<CouponAppliesTo>('FIRST_CYCLE')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitRef = useRef(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitRef.current) return

    // Client validation
    const trimmedCode = code.trim().toUpperCase()
    if (trimmedCode.length < CODE_MIN_LENGTH || trimmedCode.length > CODE_MAX_LENGTH) {
      setError(`Code must be ${CODE_MIN_LENGTH}-${CODE_MAX_LENGTH} characters`)
      return
    }
    if (!CODE_PATTERN.test(trimmedCode)) {
      setError('Code must be uppercase alphanumeric + hyphens only')
      return
    }

    const parsedValue = parseInt(discountValue, 10)
    if (isNaN(parsedValue) || parsedValue < 1) {
      setError('Discount value must be at least 1')
      return
    }
    if (discountType === 'PERCENTAGE' && parsedValue > MAX_PERCENTAGE_BASIS_POINTS) {
      setError(PERCENTAGE_CAP_MSG)
      return
    }

    if (!validFrom) {
      setError('Start date is required')
      return
    }

    setError(null)
    submitRef.current = true
    setSubmitting(true)

    const data: CreateCouponInput = {
      code: trimmedCode,
      description: description || undefined,
      discountType,
      discountValue: parsedValue,
      maxUses: maxUses ? parseInt(maxUses, 10) : null,
      maxUsesPerUser: parseInt(maxUsesPerUser, 10) || 1,
      validFrom: new Date(validFrom).toISOString(),
      validUntil: validUntil ? new Date(validUntil).toISOString() : null,
      appliesTo,
    }

    try {
      await onSubmit(data)
    } finally {
      submitRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <form className="coupon-form" onSubmit={handleSubmit}>
      <h2 className="coupon-form-title">{t.createCoupon}</h2>

      {error && (
        <div className="coupon-form-error" role="alert">{error}</div>
      )}

      <div className="coupon-form-field">
        <label htmlFor="coupon-code">Code</label>
        <input
          id="coupon-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="LAUNCH20"
          maxLength={CODE_MAX_LENGTH}
          required
          autoFocus
        />
        <span className="coupon-form-hint">{CODE_MIN_LENGTH}-{CODE_MAX_LENGTH} chars, uppercase, alphanumeric + hyphens</span>
      </div>

      <div className="coupon-form-field">
        <label htmlFor="coupon-desc">{t.descriptionInternal}</label>
        <input
          id="coupon-desc"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Launch promo — 20% off first month"
        />
      </div>

      <div className="coupon-form-row">
        <div className="coupon-form-field">
          <label htmlFor="coupon-type">{t.discountType}</label>
          <select
            id="coupon-type"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as DiscountType)}
          >
            {Object.entries(DISCOUNT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="coupon-form-field">
          <label htmlFor="coupon-value">
            {discountType === 'PERCENTAGE' ? t.valueBasisPoints : t.valuePaise}
          </label>
          <input
            id="coupon-value"
            type="number"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder={discountType === 'PERCENTAGE' ? '2000 = 20%' : '5000 = ₹50'}
            min={1}
            required
          />
        </div>
      </div>

      <div className="coupon-form-row">
        <div className="coupon-form-field">
          <label htmlFor="coupon-max-uses">{t.maxUsesTotal}</label>
          <input
            id="coupon-max-uses"
            type="number"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder={t.emptyUnlimited}
            min={1}
          />
        </div>

        <div className="coupon-form-field">
          <label htmlFor="coupon-per-user">{t.maxPerUser}</label>
          <input
            id="coupon-per-user"
            type="number"
            value={maxUsesPerUser}
            onChange={(e) => setMaxUsesPerUser(e.target.value)}
            min={1}
            required
          />
        </div>
      </div>

      <div className="coupon-form-row">
        <div className="coupon-form-field">
          <label htmlFor="coupon-from">{t.validFrom}</label>
          <input
            id="coupon-from"
            type="datetime-local"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            required
          />
        </div>

        <div className="coupon-form-field">
          <label htmlFor="coupon-until">{t.validUntilCoupon}</label>
          <input
            id="coupon-until"
            type="datetime-local"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
          <span className="coupon-form-hint">Empty = no expiry</span>
        </div>
      </div>

      <div className="coupon-form-field">
        <label htmlFor="coupon-applies">{t.appliesTo}</label>
        <select
          id="coupon-applies"
          value={appliesTo}
          onChange={(e) => setAppliesTo(e.target.value as CouponAppliesTo)}
        >
          {Object.entries(APPLIES_TO_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div className="coupon-form-actions">
        <button type="button" className="coupon-form-btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="coupon-form-btn-submit"
          disabled={submitting}
        >
          {submitting ? t.creating : t.createCoupon}
        </button>
      </div>
    </form>
  )
}
