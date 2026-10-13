/** Alert — Canonical shadcn Alert Primitive (SSOT)
 *
 * Semantic notification banners (info, success, warning, destructive).
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export const alertVariants = cva(
  'relative w-full rounded-xl border p-4 text-sm [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4',
  {
    variants: {
      variant: {
        default: 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-default)] [&>svg]:text-[var(--text-secondary)]',
        info: 'bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-info-border)] [&>svg]:text-[var(--color-info)]',
        success: 'bg-[var(--status-active-bg)] text-[var(--status-active-text)] border-[var(--status-active-border)] [&>svg]:text-[var(--status-active-dot)]',
        warning: 'bg-[var(--status-expiring-bg)] text-[var(--status-expiring-text)] border-[var(--status-expiring-border)] [&>svg]:text-[var(--status-expiring-dot)]',
        destructive: 'bg-[var(--status-expired-bg)] text-[var(--status-expired-text)] border-[var(--status-expired-border)] [&>svg]:text-[var(--status-expired-dot)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', icon, children, ...props }, ref) => {
    const defaultIcon = {
      default: <Info className="h-4 w-4" aria-hidden="true" />,
      info: <Info className="h-4 w-4" aria-hidden="true" />,
      success: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
      warning: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
      destructive: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
    }[variant || 'default']

    return (
      <div
        ref={ref}
        role={variant === 'destructive' ? 'alert' : 'status'}
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        {icon !== undefined ? icon : defaultIcon}
        <div>{children}</div>
      </div>
    )
  }
)
Alert.displayName = 'Alert'

export const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-bold leading-none tracking-tight', className)}
    {...props}
  />
))
AlertTitle.displayName = 'AlertTitle'

export const AlertDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-xs text-inherit opacity-90 leading-relaxed', className)}
    {...props}
  />
))
AlertDescription.displayName = 'AlertDescription'
