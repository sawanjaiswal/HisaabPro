import React from 'react'
import { PackageOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, type ButtonProps } from './Button'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description?: string
  action?:
    | React.ReactNode
    | {
        label: string
        onClick: () => void
        leftIcon?: React.ReactNode
        variant?: ButtonProps['variant']
      }
  secondaryAction?: {
    label: string
    onClick: () => void
    leftIcon?: React.ReactNode
  }
  compact?: boolean
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'text-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface-subtle)] flex flex-col items-center justify-center animate-in fade-in duration-200',
        compact ? 'py-8 px-4' : 'py-14 px-6',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-muted)] flex items-center justify-center shadow-2xs mb-3.5',
          compact ? 'w-10 h-10' : 'w-14 h-14'
        )}
      >
        {icon || <PackageOpen className={compact ? 'w-5 h-5' : 'w-7 h-7'} />}
      </div>

      <h4 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">{title}</h4>

      {description && (
        <p className="text-xs text-[var(--text-secondary)] font-normal max-w-sm mt-1 leading-relaxed">
          {description}
        </p>
      )}

      {children}

      {(action || secondaryAction) && (
        <div className="flex items-center justify-center gap-2.5 mt-4 flex-wrap">
          {action && (
            React.isValidElement(action) ? (
              action
            ) : typeof action === 'object' && 'label' in action ? (
              <Button
                variant={(action as any).variant || 'primary'}
                size="sm"
                leftIcon={(action as any).leftIcon}
                onClick={(action as any).onClick}
              >
                {(action as any).label}
              </Button>
            ) : null
          )}

          {secondaryAction && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={secondaryAction.leftIcon}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
