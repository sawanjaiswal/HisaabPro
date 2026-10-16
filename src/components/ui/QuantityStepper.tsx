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

    const sizeStyles = {
      sm: {
        container: 'h-8 min-w-[96px]',
        button: 'w-7 h-8',
        icon: 12,
        input: 'text-xs',
      },
      md: {
        container: 'h-9 min-w-[108px]',
        button: 'w-8 h-9',
        icon: 14,
        input: 'text-sm',
      },
      lg: {
        container: 'h-10 min-w-[120px]',
        button: 'w-9 h-10',
        icon: 15,
        input: 'text-base',
      },
    }[size]

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xs overflow-hidden select-none transition-all focus-within:border-[var(--color-primary-500)] focus-within:ring-2 focus-within:ring-[var(--color-primary-100)] dark:focus-within:ring-emerald-950/40',
          sizeStyles.container,
          disabled && 'opacity-50 pointer-events-none',
          className,
        )}
        {...props}
      >
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          aria-label={`Decrease ${ariaLabel}`}
          className={cn(
            'flex items-center justify-center shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none border-0 bg-transparent p-0',
            sizeStyles.button,
          )}
        >
          <Minus size={sizeStyles.icon} strokeWidth={2.4} aria-hidden="true" />
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
          className={cn(
            'w-full flex-1 text-center font-bold text-[var(--color-text-primary)] bg-transparent border-0 outline-none p-0 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-none',
            sizeStyles.input,
          )}
        />

        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          aria-label={`Increase ${ariaLabel}`}
          className={cn(
            'flex items-center justify-center shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none border-0 bg-transparent p-0',
            sizeStyles.button,
          )}
        >
          <Plus size={sizeStyles.icon} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
    )
  },
)

QuantityStepper.displayName = 'QuantityStepper'
