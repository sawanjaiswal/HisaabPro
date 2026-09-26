/** DateField — Canonical Date/Time Input Primitive
 *
 * Design System SSOT:
 * - Supports type: "date" | "datetime-local" | "month" | "time"
 * - Calendar icon prefix with primary tint
 * - 44px minimum touch target
 * - Consistent error and label layout
 */

import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import './date-field.css'

export type DateFieldType = 'date' | 'datetime-local' | 'month' | 'time'

export interface DateFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  /** Native input type — defaults to `date`. */
  type?: DateFieldType
}

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(
  (
    {
      label,
      error,
      hint,
      required,
      id,
      className,
      type = 'date',
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    // Naked mode: no label/error/hint — caller owns layout
    if (!label && !error && !hint) {
      return (
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cn('date-field', error && 'border-[var(--color-error-500)]', className)}
          aria-invalid={Boolean(error)}
          {...props}
        />
      )
    }

    return (
      <div className={cn('w-full space-y-1.5', className)}>
        {label && (
          <div className="flex items-center justify-between">
            <label
              htmlFor={inputId}
              className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] select-none"
            >
              <Calendar className="w-3.5 h-3.5 text-[var(--color-primary-500)]" />
              {label}
              {required && (
                <span className="text-[var(--color-error-500)] ml-1 font-bold" aria-hidden="true">
                  *
                </span>
              )}
            </label>
            {hint && !error && (
              <span className="text-xs text-[var(--text-muted)]">{hint}</span>
            )}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cn('date-field w-full', error && 'border-[var(--color-error-500)]')}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />

        {error && (
          <p
            id={`${inputId}-error`}
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

DateField.displayName = 'DateField'
