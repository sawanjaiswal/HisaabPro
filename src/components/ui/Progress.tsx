/** Progress — Canonical Radix UI / shadcn Progress Primitive (SSOT)
 *
 * Determinate loading and goal tracking bar.
 */

import * as React from 'react'
import { Progress as ProgressPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string
}

export const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value = 0, max = 100, indicatorClassName, ...props }, ref) => {
  const safeMax = max > 0 ? max : 100
  const clampedValue = Math.min(safeMax, Math.max(0, value ?? 0))
  const percentage = Math.round((clampedValue / safeMax) * 100)

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={clampedValue}
      max={safeMax}
      className={cn(
        'relative h-2.5 w-full overflow-hidden rounded-full bg-[var(--border-default)]',
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full w-full flex-1 bg-[var(--primary)] transition-all duration-300 ease-out',
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName
