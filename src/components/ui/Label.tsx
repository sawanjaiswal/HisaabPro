/** Label — Canonical Radix UI + CVA Form Label
 *
 * Design System SSOT:
 * - Uses var(--text-secondary) and var(--fs-xs) / var(--fs-sm)
 * - Built-in required asterisk indicator
 * - Disabled opacity support
 */

import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const labelVariants = cva(
  'text-sm font-medium select-none leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 transition-colors',
  {
    variants: {
      variant: {
        default: 'text-text-primary',
        muted: 'text-text-muted',
        primary: 'text-primary-600',
        error: 'text-error-600',
      },
      size: {
        sm: 'text-xs',
        default: 'text-sm font-medium normal-case tracking-normal',
        lg: 'text-base font-semibold normal-case tracking-normal',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
    VariantProps<typeof labelVariants> {
  required?: boolean
}

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, variant, size, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants({ variant, size }), className)}
    {...props}
  >
    {children}
    {required && (
      <span className="text-red-500 ml-1 font-bold" aria-hidden="true">
        *
      </span>
    )}
  </LabelPrimitive.Root>
))

Label.displayName = LabelPrimitive.Root.displayName
