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
  const generatedId = React.useId()
  const checkboxId = id || generatedId

  const checkboxNode = (
    <CheckboxPrimitive.Root
      ref={ref}
      id={checkboxId}
      data-slot="checkbox"
      className={cn(
        'peer h-4 w-4 shrink-0 rounded-[4px] border border-[var(--border-control)] bg-[var(--bg-surface)] ring-offset-background hover:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)] data-[state=checked]:text-white flex items-center justify-center transition-colors',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
        <Check className="h-3 w-3 stroke-[3] text-white" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )

  if (!label) {
    return checkboxNode
  }

  return (
    <div
      className={cn(
        'inline-flex cursor-pointer select-none gap-2',
        description ? 'items-start' : 'items-center'
      )}
    >
      {checkboxNode}
      <label
        htmlFor={checkboxId}
        className={cn(
          'cursor-pointer text-sm font-medium text-[var(--text-primary)] select-none',
          !description && 'leading-none'
        )}
      >
        <span>{label}</span>
        {description && (
          <span className="block text-xs text-[var(--text-secondary)] mt-1">
            {description}
          </span>
        )}
      </label>
    </div>
  )
})
Checkbox.displayName = CheckboxPrimitive.Root.displayName
