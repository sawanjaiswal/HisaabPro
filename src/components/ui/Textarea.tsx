/** Textarea — Canonical Shadcn CVA Textarea Primitive
 *
 * Variants:
 * - default: bordered with focus ring
 * - filled: soft gray background
 * - seamless: borderless for modern inline/card inputs
 */

import { forwardRef } from 'react'
import type { TextareaHTMLAttributes, ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const textareaVariants = cva(
  'flex w-full rounded-[var(--radius-md)] text-[var(--fs-sm)] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-surface)] border border-[var(--color-border)] p-3 focus-visible:border-[var(--color-primary-500)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-100)]',
        filled:
          'bg-[var(--color-gray-50)] border border-[var(--color-gray-200)] p-3 focus-visible:bg-[var(--color-surface)] focus-visible:border-[var(--color-primary-500)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-100)]',
        seamless:
          'bg-transparent border-0 p-0 shadow-none focus-visible:ring-0 focus-visible:outline-none resize-none',
      },
      hasError: {
        true: 'border-[var(--color-error-500)] focus-visible:border-[var(--color-error-500)] focus-visible:ring-[var(--color-error-100)]',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      hasError: false,
    },
  }
)

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  icon?: ReactNode
  showCount?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      hint,
      required,
      icon,
      showCount,
      id,
      className,
      rows = 3,
      maxLength,
      value,
      variant,
      ...props
    },
    ref
  ) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const currentLength = typeof value === 'string' ? value.length : 0

    // Naked mode: no label, error, hint, icon, or count
    if (!label && !error && !hint && !icon && !showCount) {
      return (
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          maxLength={maxLength}
          value={value}
          className={cn(
            textareaVariants({ variant, hasError: Boolean(error) }),
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
              htmlFor={textareaId}
              className="flex items-center gap-1.5 text-[var(--fs-xs)] font-bold uppercase tracking-wider text-[var(--text-secondary)] select-none"
            >
              {icon}
              {label}
              {required && (
                <span className="text-[var(--color-error-500)] font-bold" aria-hidden="true">
                  *
                </span>
              )}
            </label>
            {showCount && maxLength && (
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {currentLength}/{maxLength}
              </span>
            )}
            {hint && !error && !showCount && (
              <span className="text-[10px] text-[var(--text-muted)]">{hint}</span>
            )}
          </div>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          maxLength={maxLength}
          value={value}
          className={cn(
            textareaVariants({ variant, hasError: Boolean(error) }),
            className
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${textareaId}-error` : undefined}
          {...props}
        />

        {error && (
          <p
            id={`${textareaId}-error`}
            className="text-[var(--fs-xs)] font-medium text-[var(--color-error-600)]"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
