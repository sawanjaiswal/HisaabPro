/** DateField — the standard native date/time input.
 *
 * One home for every `type="date" | "datetime-local" | "month" | "time"`
 * field so the calendar-picker glyph, height, colours and the `color-scheme`
 * that keeps the native control light on a dark-OS desktop all live in one
 * place. Mirrors the `<Input>` API (optional `label` / `error`, else naked)
 * so it is a drop-in wherever a raw date input used to sit.
 *
 *   <DateField label={t.fromDate} value={from} max={to} onChange={…} />
 *   <DateField type="month" value={period} onChange={…} aria-label={t.period} />
 */

import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import './date-field.css'

export type DateFieldType = 'date' | 'datetime-local' | 'month' | 'time'

interface DateFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
  /** Native input type — defaults to `date`. */
  type?: DateFieldType
}

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(
  ({ label, error, id, className, type = 'date', ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    // Naked mode: no label/error — caller owns the layout (toolbars, inline rows).
    if (!label && !error) {
      return (
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cn('date-field', className)}
          {...props}
        />
      )
    }

    return (
      <div className={cn('date-field-group', error && 'date-field-group--error', className)}>
        {label && (
          <label htmlFor={inputId} className="date-field-label">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className="date-field"
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="date-field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)

DateField.displayName = 'DateField'
