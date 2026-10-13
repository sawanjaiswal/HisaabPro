import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface RadioGroupProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
  orientation?: 'horizontal' | 'vertical'
}

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  RadioGroupProps
>(({ className, orientation = 'horizontal', ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      ref={ref}
      orientation={orientation}
      className={cn(
        orientation === 'horizontal'
          ? 'flex flex-row flex-wrap items-center gap-6'
          : 'grid gap-2.5',
        className
      )}
      {...props}
    />
  )
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

export interface RadioGroupItemProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  label?: string
  description?: string
}

export const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>(({ className, label, description, id, ...props }, ref) => {
  const generatedId = React.useId()
  const radioId = id || generatedId

  const radioNode = (
    <RadioGroupPrimitive.Item
      ref={ref}
      id={radioId}
      className={cn(
        'aspect-square h-4 w-4 shrink-0 rounded-full border border-[var(--border-control)] bg-[var(--bg-surface)] text-[var(--primary)] ring-offset-background hover:border-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[var(--primary)] transition-colors',
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-2 w-2 fill-[var(--primary)] text-[var(--primary)]" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )

  if (!label) {
    return radioNode
  }

  return (
    <div
      className={cn(
        'inline-flex cursor-pointer select-none gap-2',
        description ? 'items-start' : 'items-center'
      )}
    >
      <div className={cn('shrink-0', description && 'pt-0.5')}>{radioNode}</div>
      <label
        htmlFor={radioId}
        className={cn(
          'cursor-pointer text-sm font-medium text-[var(--text-primary)]',
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
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName
