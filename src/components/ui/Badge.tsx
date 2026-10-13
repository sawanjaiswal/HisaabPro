import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold transition-colors select-none tracking-tight whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-default)]',
        primary: 'bg-[var(--primary-subtle)] text-[var(--primary)] border border-[var(--primary-subtle)]',
        emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        secondary: 'bg-slate-100 text-slate-700 border border-slate-200',
        success: 'bg-[var(--status-active-bg)] text-[var(--status-active-text)] border border-[var(--status-active-border)]',
        warning: 'bg-[var(--status-expiring-bg)] text-[var(--status-expiring-text)] border border-[var(--status-expiring-border)]',
        danger: 'bg-[var(--status-expired-bg)] text-[var(--status-expired-text)] border border-[var(--status-expired-border)]',
        outline: 'border border-[var(--border-default)] text-[var(--text-secondary)] bg-transparent',
        neutral: 'bg-slate-100 text-slate-600 border border-slate-200/60',
        paid: 'badge-paid bg-[var(--status-active-bg)] text-[var(--status-active-text)] border border-[var(--status-active-border)]',
        pending: 'badge-pending bg-[var(--status-expiring-bg)] text-[var(--status-expiring-text)] border border-[var(--status-expiring-border)]',
        overdue: 'badge-overdue bg-[var(--status-expired-bg)] text-[var(--status-expired-text)] border border-[var(--status-expired-border)]',
        draft: 'badge-draft bg-slate-100 text-slate-600 border border-slate-200',
        info: 'badge-info bg-blue-50 text-blue-700 border border-blue-200',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.2 text-[10px] font-bold uppercase tracking-wider',
        lg: 'px-3 py-1 text-sm font-bold',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  children: React.ReactNode
  icon?: React.ReactNode
  dot?: boolean
}

export function Badge({
  variant = 'default',
  size = 'default',
  children,
  icon,
  dot = false,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      role="status"
      {...props}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 bg-current opacity-80"
          aria-hidden="true"
        />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  )
}
