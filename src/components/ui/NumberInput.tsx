/** NumberInput — Canonical Fintech/Quantity Numeric Input Primitive
 *
 * Design System SSOT (Level 6):
 * - Eliminates the "cannot delete leading 0" / sticky zero bug structurally.
 * - Internal string state allows full backspace/clearing without bouncing back to 0.
 * - Enforces decimal / integer rules cleanly with no native browser stepper bugs.
 * - Blocks invalid keys (e, E, +, -) per security & design system checklists.
 * - Zero floating-point rounding artifacts.
 */

import React, { forwardRef, useState, useEffect, useCallback } from 'react'
import type { ReactNode, KeyboardEvent, ChangeEvent } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const numberInputVariants = cva(
  'flex w-full rounded-[var(--radius-md)] text-[var(--fs-sm)] font-medium text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-all focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 tabular-nums',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-surface)] border border-[var(--color-border)] focus-visible:border-[var(--color-primary-500)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-100)]',
        filled:
          'bg-[var(--color-gray-50)] border border-[var(--color-gray-200)] focus-visible:bg-[var(--color-surface)] focus-visible:border-[var(--color-primary-500)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-100)]',
      },
      inputSize: {
        sm: 'min-h-9 px-3 py-1.5 text-xs',
        default: 'min-h-11 px-3.5 py-2 text-sm',
        lg: 'min-h-[50px] px-4 py-2.5 text-sm',
      },
      hasError: {
        true: 'border-[var(--color-error-500)] focus-visible:border-[var(--color-error-500)] focus-visible:ring-[var(--color-error-100)]',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'default',
      hasError: false,
    },
  }
)

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size'>,
    VariantProps<typeof numberInputVariants> {
  value?: number | null
  onChange: (value: number) => void
  label?: string
  error?: string
  hint?: string
  unit?: string
  icon?: ReactNode
  allowDecimals?: boolean
  min?: number
  max?: number
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      value,
      onChange,
      label,
      error,
      hint,
      unit,
      icon,
      allowDecimals = true,
      min = 0,
      max,
      placeholder = '0',
      disabled = false,
      id,
      className,
      required,
      variant,
      inputSize,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    // Initial string representation: empty string if 0, undefined, or null
    const [displayValue, setDisplayValue] = useState<string>(() => {
      if (value === undefined || value === null || value === 0) return ''
      return String(value)
    })

    // Synchronize with external value changes (e.g. form reset or pre-fill)
    useEffect(() => {
      const currentNumeric = displayValue === '' ? 0 : parseFloat(displayValue)
      const targetNumeric = value ?? 0
      if (isNaN(currentNumeric) || currentNumeric !== targetNumeric) {
        setDisplayValue(targetNumeric > 0 || (targetNumeric < 0 && min < 0) ? String(targetNumeric) : '')
      }
    }, [value, min])

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLInputElement>) => {
        // Block scientific notation and +/- if not allowed
        if (['e', 'E', '+'].includes(e.key)) {
          e.preventDefault()
        }
        if (e.key === '-' && min >= 0) {
          e.preventDefault()
        }
        if (e.key === '.' && !allowDecimals) {
          e.preventDefault()
        }
        onKeyDown?.(e)
      },
      [allowDecimals, min, onKeyDown]
    )

    const handleChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value

        if (raw === '') {
          setDisplayValue('')
          onChange(0)
          return
        }

        // Sanitization based on decimal settings
        let sanitized = allowDecimals
          ? raw.replace(/[^0-9.]/g, '')
          : raw.replace(/[^0-9]/g, '')

        if (allowDecimals) {
          const parts = sanitized.split('.')
          if (parts.length > 2) {
            sanitized = `${parts[0]}.${parts.slice(1).join('')}`
          }
        }

        setDisplayValue(sanitized)

        if (sanitized === '' || sanitized === '.') {
          onChange(0)
          return
        }

        const parsed = allowDecimals ? parseFloat(sanitized) : parseInt(sanitized, 10)
        if (!isNaN(parsed)) {
          if (max !== undefined && parsed > max) {
            onChange(max)
          } else {
            onChange(parsed)
          }
        }
      },
      [allowDecimals, max, onChange]
    )

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <div className="flex items-center justify-between">
            <label
              htmlFor={inputId}
              className="block text-sm font-medium text-[var(--color-text-primary)] select-none"
            >
              {label}
              {required && (
                <span className="text-[var(--color-error-500)] ml-1 font-bold" aria-hidden="true">
                  *
                </span>
              )}
            </label>
            {unit && (
              <span className="text-xs font-medium text-[var(--color-text-muted)] select-none">
                {unit}
              </span>
            )}
          </div>
        )}

        <div className="relative flex items-center">
          {icon && (
            <div
              className="absolute left-3.5 flex items-center justify-center text-[var(--color-gray-400)] pointer-events-none"
              aria-hidden="true"
            >
              {icon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode={allowDecimals ? 'decimal' : 'numeric'}
            pattern={allowDecimals ? '[0-9]*[.]?[0-9]*' : '[0-9]*'}
            value={displayValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              numberInputVariants({ variant, inputSize, hasError: Boolean(error) }),
              icon && 'pl-10',
              className
            )}
            aria-invalid={Boolean(error)}
            aria-label={label || placeholder}
            {...props}
          />
        </div>

        {hint && !error && (
          <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>
        )}

        {error && (
          <p className="text-xs font-medium text-[var(--color-error-500)]" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)

NumberInput.displayName = 'NumberInput'
