import React from 'react'
import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export type CardVariant = 'default' | 'accent' | 'primary' | 'flat' | 'glass' | 'elevated' | 'bordered'

export const cardVariants = cva(
  'rounded-2xl border text-[var(--text-primary)] transition-all duration-150',
  {
    variants: {
      variant: {
        default: 'border-[var(--border-default)] bg-[var(--bg-surface)] shadow-2xs',
        flat: 'border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] shadow-none',
        glass: 'border-white/40 bg-white/70 backdrop-blur-md shadow-2xs',
        elevated: 'border-[var(--border-default)] bg-[var(--bg-surface)] shadow-md',
        bordered: 'border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-none',
        accent: 'card-accent',
        primary: 'card-primary',
      },
      elevated: {
        true: 'shadow-md',
        false: '',
      },
      compact: {
        true: 'p-3',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      elevated: false,
      compact: false,
    },
  }
)

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  hover?: boolean
  clickable?: boolean
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = 'default',
      elevated = false,
      compact = false,
      hover = false,
      clickable = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          cardVariants({ variant, elevated, compact }),
          hover && 'hover:border-[var(--border-strong)] hover:shadow-xs hover:bg-[var(--bg-surface-hover)]',
          clickable && 'cursor-pointer active:scale-[0.99] select-none',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-5', className)}
      {...props}
    />
  )
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-bold leading-tight tracking-tight text-[var(--text-primary)] text-base sm:text-lg', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-xs text-[var(--text-secondary)] font-normal leading-relaxed', className)}
      {...props}
    />
  )
)
CardDescription.displayName = 'CardDescription'

export const CardContent = React.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center p-5 pt-0', className)}
      {...props}
    />
  )
)
CardFooter.displayName = 'CardFooter'
