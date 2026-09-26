/** FormField — Universal Field Wrapper Primitive
 *
 * Design System SSOT:
 * - Provides standardized layout for any input control (Select, Custom Pickers, Toggles)
 * - Label with required marker
 * - Hint / Description slot
 * - Accessible error message with role="alert"
 */

import React from 'react'
import { Label } from './Label'
import { cn } from '@/lib/utils'

export interface FormFieldProps {
  label?: string
  htmlFor?: string
  required?: boolean
  hint?: string
  error?: string
  className?: string
  children: React.ReactNode
}

export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label htmlFor={htmlFor} required={required}>
            {label}
          </Label>
          {hint && !error && (
            <span className="text-[10px] text-[var(--text-muted)] select-none">{hint}</span>
          )}
        </div>
      )}

      {children}

      {error && (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          className="text-[var(--fs-xs)] font-medium text-[var(--color-error-600)]"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}
