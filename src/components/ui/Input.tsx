/** Input — Level 6 Canonical SSOT Input Primitive */

import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode, MouseEvent, ChangeEvent, FocusEvent } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatName, formatGSTIN, formatPAN } from '@/lib/format'

export const inputVariants = cva(
  'flex w-full rounded-xl text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-surface)] placeholder:text-[var(--text-muted)] transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
  {
    variants: {
      variant: {
        default:
          'border border-[var(--border-default)] focus:border-[var(--primary)] focus:ring-0 focus-visible:border-[var(--primary)] focus-visible:ring-0',
        filled:
          'bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:bg-[var(--bg-surface)] focus:border-[var(--primary)] focus:ring-0 focus-visible:bg-[var(--bg-surface)] focus-visible:border-[var(--primary)] focus-visible:ring-0',
        seamless:
          'bg-transparent border-0 shadow-none p-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none',
      },
      inputSize: {
        sm: 'h-8 min-h-[32px] px-2.5 py-1 text-xs',
        default: 'h-11 min-h-[44px] px-3.5 py-2 text-sm',
        lg: 'h-12 min-h-[48px] px-4 py-2.5 text-base',
        hero: 'h-14 min-h-[56px] px-4 py-2 text-2xl font-bold tabular-nums',
      },
      hasError: {
        true: 'border-[var(--color-error)] focus-visible:border-[var(--color-error)] focus-visible:ring-1 focus-visible:ring-[var(--color-error)]',
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

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  label?: string
  error?: string
  hint?: string
  helperText?: string
  icon?: ReactNode
  leftIcon?: ReactNode
  iconRight?: ReactNode
  rightIcon?: ReactNode
  prefixText?: string
  suffixText?: string
  clearable?: boolean
  onClear?: () => void
  required?: boolean
  size?: 'sm' | 'default' | 'lg' | 'hero'
  /**
   * Automatic text formatting on blur:
   * - 'name': Title case, preserve business acronyms ("sawan jaiswal" -> "Sawan Jaiswal", "pvt ltd" -> "PVT LTD")
   * - 'uppercase': Convert to uppercase (GSTIN, PAN, IFSC, Vehicle Number)
   * - 'lowercase': Convert to lowercase (email, username)
   * - 'trim': Strip leading, trailing, and excessive inner whitespace
   * - 'auto': (default) automatically infers 'name' when id/label/placeholder/autoComplete indicates an entity name
   * - 'none': disable all auto-formatting
   */
  autoFormat?: 'name' | 'uppercase' | 'lowercase' | 'trim' | 'auto' | 'none'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      helperText,
      icon,
      leftIcon,
      iconRight,
      rightIcon,
      prefixText,
      suffixText,
      clearable = false,
      onClear,
      required,
      id,
      className,
      variant,
      inputSize,
      size,
      value,
      onChange,
      onBlur,
      autoFormat = 'auto',
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const activeLeftIcon = leftIcon || icon
    const activeRightIcon = rightIcon || iconRight
    const effectiveSize = size || inputSize || 'default'
    const hasValue = value !== undefined && String(value).length > 0
    const displayedHint = hint || helperText

    const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
      onBlur?.(e)

      if (autoFormat === 'none' || props.type === 'password' || props.type === 'number') {
        return
      }

      const rawVal = e.target.value
      if (!rawVal || typeof rawVal !== 'string') return

      let formatted: string | null = null

      if (autoFormat === 'name') {
        formatted = formatName(rawVal)
      } else if (autoFormat === 'uppercase') {
        formatted = rawVal.trim().toUpperCase()
      } else if (autoFormat === 'lowercase') {
        formatted = rawVal.trim().toLowerCase()
      } else if (autoFormat === 'trim') {
        formatted = rawVal.trim().replace(/\s+/g, ' ')
      } else if (autoFormat === 'auto') {
        // Infer from label, id, name, placeholder, autoComplete, or aria-label if it's an entity name
        const rawId = (id || '').toLowerCase()
        const ariaLabel = (props['aria-label'] || '').toLowerCase()
        const textToCheck = `${label || ''} ${inputId} ${rawId} ${ariaLabel} ${props.name || ''} ${props.placeholder || ''} ${props.autoComplete || ''}`.toLowerCase()
        const isNameField = /(name|party|customer|vendor|supplier|employee|category|godown|business|company|city|state|bank|designation|branch|role)/.test(textToCheck)
        const isGstin = /\b(gstin|gst)\b/.test(textToCheck)
        const isPan = /\b(pan)\b/.test(textToCheck)

        if (isGstin) {
          const res = formatGSTIN(rawVal)
          if (res && res !== '—') formatted = res
        } else if (isPan) {
          const res = formatPAN(rawVal)
          if (res && res !== '—') formatted = res
        } else if (isNameField) {
          const res = formatName(rawVal)
          if (res && res !== '—') formatted = res
        }
      }

      if (formatted && formatted !== '—' && formatted !== rawVal) {
        if (onChange) {
          const syntheticEvent = {
            target: { value: formatted, name: props.name || inputId },
            currentTarget: { value: formatted, name: props.name || inputId },
            persist: () => {},
            preventDefault: () => {},
            stopPropagation: () => {},
            defaultPrevented: false,
            nativeEvent: e.nativeEvent,
          } as unknown as ChangeEvent<HTMLInputElement>
          onChange(syntheticEvent)
        }
      }
    }

    const handleClear = (e: MouseEvent) => {
      e.stopPropagation()
      onClear?.()
      if (onChange) {
        const syntheticEvent = {
          target: { value: '', name: props.name || inputId },
          currentTarget: { value: '', name: props.name || inputId },
          persist: () => {},
          preventDefault: () => {},
          stopPropagation: () => {},
          defaultPrevented: false,
          nativeEvent: e.nativeEvent,
        } as unknown as ChangeEvent<HTMLInputElement>
        onChange(syntheticEvent)
      }
    }

    // Naked mode: no label, error, hint, or icons/prefixes
    if (!label && !error && !displayedHint && !activeLeftIcon && !activeRightIcon && !prefixText && !suffixText && !clearable) {
      return (
        <input
          ref={ref}
          id={inputId}
          value={value}
          onChange={onChange}
          onBlur={handleBlur}
          className={cn(
            inputVariants({ variant, inputSize: effectiveSize, hasError: Boolean(error) }),
            className
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
      )
    }

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <label
                htmlFor={inputId}
                className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] select-none"
              >
                {label}
              </label>
              {required && (
                <span className="text-[var(--color-error)] ml-1 font-bold" aria-hidden="true">
                  *
                </span>
              )}
            </div>
            {displayedHint && !error && (
              <span id={`${inputId}-hint`} className="text-xs text-[var(--text-muted)]">
                {displayedHint}
              </span>
            )}
          </div>
        )}

        <div className="relative flex items-center w-full">
          {prefixText && (
            <span
              className="absolute left-3 text-xs font-bold text-[var(--text-secondary)] pointer-events-none select-none"
              aria-hidden="true"
            >
              {prefixText}
            </span>
          )}

          {activeLeftIcon && !prefixText && (
            <span
              className="absolute left-3 flex items-center justify-center text-[var(--text-muted)] pointer-events-none"
              aria-hidden="true"
            >
              {activeLeftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            value={value}
            onChange={onChange}
            onBlur={handleBlur}
            className={cn(
              inputVariants({ variant, inputSize: effectiveSize, hasError: Boolean(error) }),
              (activeLeftIcon || prefixText) && 'pl-8',
              (activeRightIcon || suffixText || (clearable && hasValue)) && 'pr-9',
              className
            )}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error
                ? `${inputId}-error`
                : displayedHint
                ? `${inputId}-hint`
                : undefined
            }
            {...props}
          />

          {suffixText && (
            <span
              className="absolute right-3 text-xs font-semibold text-[var(--text-secondary)] pointer-events-none select-none"
              aria-hidden="true"
            >
              {suffixText}
            </span>
          )}

          {clearable && hasValue && !suffixText && !activeRightIcon && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-full transition-colors cursor-pointer"
              aria-label="Clear input"
            >
              <X size={14} />
            </button>
          )}

          {activeRightIcon && !suffixText && (
            <span
              className="absolute right-3 flex items-center justify-center text-[var(--text-muted)] pointer-events-none"
              aria-hidden="true"
            >
              {activeRightIcon}
            </span>
          )}
        </div>

        {error && (
          <p
            id={`${inputId}-error`}
            className="text-xs font-medium text-[var(--color-error)]"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
