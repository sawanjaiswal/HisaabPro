/**
 * CouponInput — User-facing coupon code input for checkout
 * Feature #96
 *
 * States: collapsed → expanded → validating → applied/error
 */

import { useState, useRef, useCallback } from 'react'
import { Tag, X, Loader2, ChevronDown } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { validateCouponCode, applyCouponCode, removeCouponCode } from '../coupon.service'
import type { CouponValidationResult, CouponApplyResult } from '../coupon.types'
import './coupon-input.css'
import { useLanguage } from '@/hooks/useLanguage'

interface CouponInputProps {
  planId?: string
  planAmountPaise?: number
  razorpaySubscriptionId?: string
  onApplied?: (result: CouponApplyResult) => void
  onRemoved?: () => void
}

type InputState = 'collapsed' | 'expanded' | 'validating' | 'applied' | 'error'

export function CouponInput({ planId, planAmountPaise, razorpaySubscriptionId, onApplied, onRemoved }: CouponInputProps) {
  const { t } = useLanguage()
  const [state, setState] = useState<InputState>('collapsed')
  const [code, setCode] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [appliedResult, setAppliedResult] = useState<CouponValidationResult | null>(null)
  const [redemptionId, setRedemptionId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const submitRef = useRef(false)

  const handleApply = useCallback(async () => {
    const trimmed = code.trim()
    if (!trimmed || submitRef.current) return

    submitRef.current = true
    setState('validating')
    setErrorMsg('')

    try {
      // Step 1: Validate
      const validation = await validateCouponCode(trimmed, planId, planAmountPaise)

      if (!validation.valid) {
        setState('error')
        setErrorMsg(validation.error?.message ?? t.invalidCouponCode)
        submitRef.current = false
        return
      }

      // Step 2: Apply
      const result = await applyCouponCode(trimmed, planId, planAmountPaise, razorpaySubscriptionId)
      setAppliedResult(validation)
      setRedemptionId(result.redemption.id)
      setState('applied')
      onApplied?.(result)
    } catch (err: unknown) {
      setState('error')
      setErrorMsg(err instanceof ApiError ? err.message : t.somethingWentWrong)
    } finally {
      submitRef.current = false
    }
  }, [code, planId, planAmountPaise, razorpaySubscriptionId, onApplied])

  const handleRemove = useCallback(async () => {
    if (!redemptionId || removing) return

    setRemoving(true)
    try {
      await removeCouponCode(redemptionId)
      setState('expanded')
      setCode('')
      setAppliedResult(null)
      setRedemptionId(null)
      onRemoved?.()
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : t.failedRemoveCoupon
      setErrorMsg(msg)
    } finally {
      setRemoving(false)
    }
  }, [redemptionId, removing, onRemoved])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleApply()
      }
    },
    [handleApply]
  )

  // Collapsed state — "Have a coupon code?" link
  if (state === 'collapsed') {
    return (
      <button
        className="coupon-input-toggle"
        onClick={() => setState('expanded')}
        type="button"
      >
        <Tag size={16} aria-hidden="true" />
        Have a coupon code?
        <ChevronDown size={16} aria-hidden="true" />
      </button>
    )
  }

  // Applied state — green success banner
  if (state === 'applied' && appliedResult) {
    return (
      <div className="coupon-input-applied" role="status">
        <Tag size={16} aria-hidden="true" className="coupon-input-applied-icon" />
        <span className="coupon-input-applied-text">
          {appliedResult.message}
        </span>
        <button
          className="coupon-input-remove"
          onClick={handleRemove}
          disabled={removing}
          type="button"
          aria-label={t.removeCoupon}
        >
          {removing ? <Loader2 size={14} className="spinner" /> : <X size={14} />}
          Remove
        </button>
      </div>
    )
  }

  // Expanded / validating / error — input + button
  return (
    <div className="coupon-input-wrapper">
      <div className="coupon-input-row">
        <input
          type="text"
          className="coupon-input-field"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            if (state === 'error') setState('expanded')
          }}
          onKeyDown={handleKeyDown}
          placeholder={t.couponCodeInput}
          disabled={state === 'validating'}
          autoFocus
          aria-label={t.couponCodeInput}
          aria-invalid={state === 'error'}
          aria-describedby={state === 'error' ? 'coupon-error' : undefined}
        />
        <button
          className="coupon-input-apply"
          onClick={handleApply}
          disabled={!code.trim() || state === 'validating'}
          type="button"
        >
          {state === 'validating' ? (
            <Loader2 size={16} className="spinner" aria-label={t.validating} />
          ) : (
            'Apply'
          )}
        </button>
      </div>
      {state === 'error' && errorMsg && (
        <p id="coupon-error" className="coupon-input-error" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  )
}
