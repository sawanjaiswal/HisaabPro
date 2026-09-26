/** CurrencyInput — Canonical Fintech Currency Input Primitive
 *
 * Design System SSOT:
 * - Tabular numbers (tabular-nums) with currency symbol
 * - Values handled in PAISE for financial correctness (or direct rupees)
 * - Zero browser stepper arrows
 * - Two visual modes: 'hero' (center-stage payment/POS) or 'default' (inline form row)
 * - Optional one-tap quick-add chips
 */

import React, { forwardRef, useCallback } from 'react'
import { IndianRupee } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRupees } from '@/lib/format'
import { Button } from './Button'

export interface CurrencyInputProps {
  /** Value in PAISE (100 paise = ₹1) */
  value: number
  /** Callback when amount changes (in PAISE) */
  onChange: (paise: number) => void
  /** Label text above the input */
  label?: string
  /** Error message string */
  error?: string
  /** Visual presentation mode */
  variant?: 'hero' | 'default' | 'filled'
  /** Quick amount chips (in RUPEES, e.g. [500, 1000, 2000, 5000]) */
  quickAmounts?: number[]
  /** Disabled state */
  disabled?: boolean
  /** Input ID */
  id?: string
  /** Custom container class */
  className?: string
  /** Required field flag */
  required?: boolean
  /** Placeholder text */
  placeholder?: string
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value,
      onChange,
      label,
      error,
      variant = 'default',
      quickAmounts,
      disabled = false,
      id,
      className,
      required,
      placeholder = '0.00',
    },
    ref
  ) => {
    const inputId = id || 'currency-amount-input'

    const [displayValue, setDisplayValue] = React.useState<string>(() =>
      value > 0 ? (value % 100 === 0 ? String(value / 100) : (value / 100).toFixed(2)) : ''
    )

    React.useEffect(() => {
      const currentPaise = displayValue ? Math.round(parseFloat(displayValue) * 100) : 0
      if (isNaN(currentPaise) || currentPaise !== value) {
        setDisplayValue(value > 0 ? (value % 100 === 0 ? String(value / 100) : String(value / 100)) : '')
      }
    }, [value])

    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^0-9.]/g, '')
        const parts = raw.split('.')
        const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : raw
        setDisplayValue(sanitized)

        if (sanitized === '' || sanitized === '.') {
          onChange(0)
          return
        }
        const parsed = parseFloat(sanitized)
        const paise = Math.round(parsed * 100)
        onChange(isNaN(paise) ? 0 : paise)
      },
      [onChange]
    )

    const handleQuickAdd = useCallback(
      (rupees: number) => {
        onChange(rupees * 100)
      },
      [onChange]
    )

    // ── 1. Hero Mode (Center-Stage Display) ───────────────────────────────────
    if (variant === 'hero') {
      return (
        <div className={cn('text-center py-3 space-y-2', className)}>
          {label && (
            <p className="text-xs font-bold uppercase tracking-widest text-text-muted select-none">
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </p>
          )}

          <div className="flex items-center justify-center gap-1.5 my-1">
            <span
              className="text-4xl sm:text-6xl font-bold select-none leading-none"
              style={{ color: 'var(--color-primary-600)' }}
            >
              ₹
            </span>
            <input
              ref={ref}
              id={inputId}
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.]?[0-9]*"
              placeholder="0"
              disabled={disabled}
              className="w-56 sm:w-72 bg-transparent border-0 text-center text-5xl sm:text-6xl font-black focus:outline-none tabular-nums p-0 shadow-none disabled:opacity-50"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-primary)',
                letterSpacing: '-0.03em',
              }}
              value={displayValue}
              onChange={handleInputChange}
              aria-label={label || 'Amount'}
            />
          </div>

          {quickAmounts && quickAmounts.length > 0 && (
            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              {quickAmounts.map((q) => (
                <Button
                  key={q}
                  type="button"
                  variant="none"
                  disabled={disabled}
                  onClick={() => handleQuickAdd(q)}
                  className="px-3 py-1 rounded-full text-xs font-semibold transition-all hover:opacity-80 active:scale-95 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--color-gray-100)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  +{formatRupees(q * 100)}
                </Button>
              ))}
            </div>
          )}

          {error && (
            <span
              className="block text-xs font-medium mt-2 text-error-600"
              role="alert"
            >
              {error}
            </span>
          )}
        </div>
      )
    }

    // ── 2. Default & Filled Inline Mode ───────────────────────────────────────
    return (
      <div className={cn('w-full space-y-1.5', className)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--color-text-primary)] select-none"
          >
            {label}
            {required && <span className="text-[var(--color-error-500)] ml-1 font-bold">*</span>}
          </label>
        )}

        <div
          className={cn(
            'flex items-center gap-2.5 px-3.5 py-2 rounded-[var(--radius-md)] border transition-all focus-within:ring-2 focus-within:ring-[var(--color-primary-100)] focus-within:border-[var(--color-primary-500)]',
            variant === 'filled'
              ? 'bg-[var(--color-gray-50)] border-[var(--color-border)]'
              : 'bg-[var(--color-surface)] border-[var(--color-border)]',
            error && 'border-[var(--color-error-500)] focus-within:border-[var(--color-error-500)]'
          )}
        >
          <div
            className="flex items-center justify-center w-6 h-6 rounded-sm flex-shrink-0 select-none text-[var(--color-primary-600)]"
            aria-hidden="true"
          >
            <IndianRupee size={16} strokeWidth={2.5} />
          </div>

          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            placeholder={placeholder}
            disabled={disabled}
            className="w-full bg-transparent border-0 text-sm font-bold text-text-primary placeholder:text-text-muted focus:outline-none tabular-nums p-0 shadow-none"
            value={displayValue}
            onChange={handleInputChange}
            aria-label={label || 'Amount in Rupees'}
            aria-invalid={Boolean(error)}
          />
        </div>

        {error && (
          <p className="text-xs font-medium text-error-600" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)

CurrencyInput.displayName = 'CurrencyInput'
