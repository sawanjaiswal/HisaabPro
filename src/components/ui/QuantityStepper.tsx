/** QuantityStepper — Canonical shadcn/ui Stepper Primitive (SSOT)
 *
 * Professional, touch-optimized numeric increment/decrement component.
 */

import * as React from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface QuantityStepperProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  ariaLabel?: string
  name?: string
}

export const QuantityStepper = React.forwardRef<HTMLDivElement, QuantityStepperProps>(
  (
    {
      value,
      onChange,
      min = 0,
      max = Number.MAX_SAFE_INTEGER,
      step = 1,
      disabled = false,
      size = 'md',
      ariaLabel = 'Quantity',
      className,
      ...props
    },
    ref,
  ) => {
    const handleDecrement = React.useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        if (disabled) return
        const next = Math.max(min, Number(((value || 0) - step).toFixed(2)))
        onChange(next)
      },
      [disabled, min, onChange, step, value],
    )

    const handleIncrement = React.useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        if (disabled) return
        const next = Math.min(max, Number(((value || 0) + step).toFixed(2)))
        onChange(next)
      },
      [disabled, max, onChange, step, value],
    )

    const handleInputChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value
        if (raw === '') {
          onChange(min)
          return
        }
        const parsed = parseFloat(raw)
        if (!isNaN(parsed)) {
          const clamped = Math.max(min, Math.min(max, parsed))
          onChange(clamped)
        }
      },
      [max, min, onChange],
    )

    const iconSize = {
      sm: 12,
      md: 14,
      lg: 15,
    }[size]

    return (
      <div
        ref={ref}
        className={cn(
          'quantity-stepper',
          `quantity-stepper--${size}`,
          disabled && 'quantity-stepper--disabled',
          className,
        )}
        {...props}
      >
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          aria-label={`Decrease ${ariaLabel}`}
          className="quantity-stepper__btn"
        >
          <Minus size={iconSize} strokeWidth={2.4} aria-hidden="true" />
        </button>

        <input
          type="number"
          value={value === 0 ? '' : value}
          placeholder="0"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={handleInputChange}
          onFocus={(e) => e.target.select()}
          aria-label={ariaLabel}
          className="quantity-stepper__input"
        />

        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          aria-label={`Increase ${ariaLabel}`}
          className="quantity-stepper__btn"
        >
          <Plus size={iconSize} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
    )
  },
)

QuantityStepper.displayName = 'QuantityStepper'
