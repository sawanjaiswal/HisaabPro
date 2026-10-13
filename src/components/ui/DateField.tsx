/** DateField — Canonical Date/Time Input Primitive
 *
 * Design System SSOT (Level 6):
 * - Delegates "date" and "datetime-local" to Shadcn UI DatePicker (from @/components/ui/DatePicker)
 *   providing the interactive calendar popover, custom presets, typing mask, and design tokens.
 * - Supports type: "date" | "datetime-local" | "month" | "time"
 * - Maintains 100% backward compatibility with all existing onChange / value call-sites.
 */

import { forwardRef } from 'react'
import type { InputHTMLAttributes, ChangeEvent } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DatePicker } from './DatePicker'
import './date-field.css'

export type DateFieldType = 'date' | 'datetime-local' | 'month' | 'time'

export interface DateFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  /** Native or virtual input type — defaults to `date`. */
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
      value,
      defaultValue,
      onChange,
      disabled,
      placeholder,
      min,
      max,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    // When type is date or datetime-local, render Shadcn UI DatePicker
    if (type === 'date' || type === 'datetime-local') {
      const showTime = type === 'datetime-local'
      const strVal = value !== undefined && value !== null ? String(value) : undefined
      const defaultStrVal = defaultValue !== undefined && defaultValue !== null ? String(defaultValue) : undefined

      const handlePickerChange = (isoVal: string) => {
        if (!onChange) return
        const syntheticEvent = {
          target: { value: isoVal, name: props.name || '', id: inputId || '' },
          currentTarget: { value: isoVal, name: props.name || '', id: inputId || '' },
          preventDefault: () => {},
          stopPropagation: () => {},
        } as unknown as ChangeEvent<HTMLInputElement>
        onChange(syntheticEvent)
      }

      const pickerElement = (
        <DatePicker
          id={inputId}
          name={props.name}
          value={strVal}
          defaultValue={defaultStrVal}
          onChange={handlePickerChange}
          showTime={showTime}
          error={error}
          disabled={disabled}
          placeholder={placeholder || (showTime ? 'DD / MM / YYYY, HH:mm' : 'DD / MM / YYYY')}
          minDate={typeof min === 'string' ? min : undefined}
          maxDate={typeof max === 'string' ? max : undefined}
          required={required}
          className={cn('w-full', className)}
        />
      )

      if (!label && !error && !hint) {
        return pickerElement
      }

      return (
        <div className={cn('w-full space-y-1.5', className)}>
          {label && (
            <div className="flex items-center justify-between">
              <label
                htmlFor={inputId}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] select-none"
              >
                <Calendar className="w-3.5 h-3.5 text-[var(--primary)]" />
                {label}
                {required && (
                  <span className="text-rose-500 ml-1 font-bold" aria-hidden="true">
                    *
                  </span>
                )}
              </label>
              {hint && !error && (
                <span className="text-[11px] text-[var(--text-muted)]">{hint}</span>
              )}
            </div>
          )}

          {pickerElement}

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

    // Fallback for native "month" or "time" inputs
    if (!label && !error && !hint) {
      return (
        <input
          ref={ref}
          id={inputId}
          type={type}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          min={min}
          max={max}
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
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          min={min}
          max={max}
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
