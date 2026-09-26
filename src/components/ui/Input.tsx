/** Input — Canonical Shadcn CVA Input Primitive
 *
 * Variants:
 * - default: standard bordered input with focus-visible ring
 * - filled: soft gray background with border
 * - seamless: borderless transparent input (for cards / hero fields)
 *
 * Sizes:
 * - sm (36px min-h)
 * - default (44px touch target)
 * - lg (50px touch target)
 * - hero (large typography for amounts / prominent codes)
 */

import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const inputVariants = cva(
  'flex w-full rounded-md text-sm font-medium text-text-primary placeholder:text-text-muted transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-surface border border-border focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-100',
        filled:
          'bg-gray-50 border border-gray-200 focus-visible:bg-surface focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-100',
        seamless:
          'bg-transparent border-0 shadow-none p-0 focus-visible:ring-0 focus-visible:outline-none',
      },
      inputSize: {
        sm: 'min-h-9 px-3 py-1.5 text-xs',
        default: 'min-h-11 px-3.5 py-2 text-sm',
        lg: 'min-h-[50px] px-4 py-2.5 text-sm',
        hero: 'min-h-[56px] px-0 py-1 text-[var(--fs-3xl)] font-bold tabular-nums',
      },
      hasError: {
        true: 'border-red-500 focus-visible:border-red-500 focus-visible:ring-[var(--color-error-100)]',
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
  icon?: ReactNode
  iconRight?: ReactNode
  required?: boolean
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      icon,
      iconRight,
      required,
      hint,
      id,
      className,
      variant,
      inputSize,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    // Naked mode: no label, error, hint, or icons
    if (!label && !error && !hint && !icon && !iconRight) {
      return (
        <input
          ref={ref}
          id={inputId}
          className={cn(
            inputVariants({ variant, inputSize, hasError: Boolean(error) }),
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
            <label
              htmlFor={inputId}
              className="block text-xs font-bold uppercase tracking-wider text-text-secondary select-none"
            >
              {label}
              {required && (
                <span className="text-red-500 ml-1 font-bold" aria-hidden="true">
                  *
                </span>
              )}
            </label>
            {hint && !error && (
              <span className="text-[10px] text-text-muted">{hint}</span>
            )}
          </div>
        )}

        <div className="relative flex items-center w-full">
          {icon && (
            <span
              className="absolute left-3 flex items-center justify-center text-text-muted pointer-events-none"
              aria-hidden="true"
            >
              {icon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              inputVariants({ variant, inputSize, hasError: Boolean(error) }),
              icon && 'pl-9',
              iconRight && 'pr-9',
              className
            )}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />

          {iconRight && (
            <span
              className="absolute right-3 flex items-center justify-center text-text-muted pointer-events-none"
              aria-hidden="true"
            >
              {iconRight}
            </span>
          )}
        </div>

        {error && (
          <p
            id={`${inputId}-error`}
            className="text-xs font-medium text-error-600"
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
