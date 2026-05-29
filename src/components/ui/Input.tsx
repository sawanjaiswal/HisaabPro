import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Variants map to the existing `input*` classes in components-ui.css — visual
// identity unchanged; cva makes the icon/error modifiers the single source of
// truth for the field's class contract.
const inputGroupVariants = cva('input-group', {
  variants: { error: { true: 'input-group-error', false: '' } },
  defaultVariants: { error: false },
})

const inputFieldVariants = cva('input', {
  variants: { withIcon: { true: 'input-with-icon', false: '' } },
  defaultVariants: { withIcon: false },
})

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, id, className, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className={cn(inputGroupVariants({ error: !!error }), className)}>
        {label && (
          <label htmlFor={inputId} className="input-label">
            {label}
          </label>
        )}
        <div className="input-wrapper">
          {icon && <span className="input-icon" aria-hidden="true">{icon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={inputFieldVariants({ withIcon: !!icon })}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
        </div>
        {error && (
          <p id={`${inputId}-error`} className="input-error" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
