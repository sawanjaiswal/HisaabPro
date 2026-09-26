/** Checkbox — Canonical Radix UI Checkbox Primitive
 *
 * Design System SSOT:
 * - Active: Emerald background (var(--color-primary-500)) with white check
 * - 44px touch target alignment
 * - Accessible focus-visible ring
 */

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: string
  description?: string
}

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, label, description, id, ...props }, ref) => {
  const checkboxId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  const checkboxNode = (
    <CheckboxPrimitive.Root
      ref={ref}
      id={checkboxId}
      className={cn(
        'peer h-5 w-5 shrink-0 rounded-sm border border-border bg-surface ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary-500 data-[state=checked]:border-primary-500 data-[state=checked]:text-[var(--color-gray-0)] transition-all',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn('flex items-center justify-center text-current')}
      >
        <Check className="h-3.5 w-3.5 stroke-[3]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )

  if (!label) {
    return checkboxNode
  }

  return (
    <div className="flex items-start gap-2.5 cursor-pointer select-none">
      <div className="pt-0.5">{checkboxNode}</div>
      <label htmlFor={checkboxId} className="cursor-pointer space-y-0.5">
        <span className="block text-sm font-semibold text-text-primary">
          {label}
        </span>
        {description && (
          <span className="block text-xs text-text-secondary">
            {description}
          </span>
        )}
      </label>
    </div>
  )
})

Checkbox.displayName = CheckboxPrimitive.Root.displayName
