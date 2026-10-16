import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { Spinner } from '@/components/feedback/Spinner'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center font-bold tracking-tight select-none transition-all duration-150 shrink-0 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-xs focus-visible:ring-[var(--primary)] active:scale-[0.98]',
        primary: 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-xs focus-visible:ring-[var(--primary)] active:scale-[0.98]',
        secondary: 'bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-default)] shadow-2xs focus-visible:ring-slate-400 active:scale-[0.98]',
        outline: 'border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] bg-[var(--bg-surface)] shadow-2xs focus-visible:ring-[var(--primary)] active:scale-[0.98]',
        accent: 'bg-[var(--color-secondary-300,#cfdf2e)] hover:bg-[var(--color-secondary-400,#b3bb3a)] text-[var(--primary-active,#013d20)] font-extrabold shadow-xs active:scale-[0.98]',
        destructive: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs focus-visible:ring-rose-500 active:scale-[0.98]',
        'outline-destructive': 'border border-rose-300 hover:bg-rose-50 text-rose-700 focus-visible:ring-rose-400 active:scale-[0.98]',
        ghost: 'hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:ring-slate-300 active:scale-[0.98]',
        dark: 'bg-slate-900 hover:bg-black text-white shadow-xs focus-visible:ring-slate-950 active:scale-[0.98]',
        none: '',
      },
      size: {
        default: 'text-xs sm:text-sm px-4 py-2 h-10 min-h-[40px] gap-2 rounded-xl',
        sm: 'text-xs px-3 py-1.5 h-8 min-h-[32px] gap-1.5 rounded-lg font-semibold',
        md: 'text-xs sm:text-sm px-4 py-2 h-10 min-h-[40px] gap-2 rounded-xl font-bold',
        lg: 'text-sm sm:text-base px-6 py-2.5 h-11 min-h-[44px] gap-2.5 rounded-xl font-bold',
        icon: 'h-10 w-10 min-h-[40px] min-w-[40px] p-0 rounded-xl justify-center',
        'icon-sm': 'h-8 w-8 min-h-[32px] min-w-[32px] p-0 rounded-lg justify-center',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  isLoading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  asChild?: boolean
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    isLoading = false,
    leftIcon,
    rightIcon,
    asChild = false,
    disabled,
    children,
    className,
    type = 'button',
    ...props
  },
  ref
) {
  const isBusy = loading || isLoading
  const Comp = asChild ? Slot.Root : 'button'
  const classes =
    variant === 'none'
      ? className
      : cn(buttonVariants({ variant, size, fullWidth }), className)

  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={classes}
      disabled={asChild ? undefined : disabled || isBusy}
      aria-label={typeof children === 'string' ? children : undefined}
      aria-busy={isBusy || undefined}
      {...props}
    >
      {!asChild && isBusy ? (
        <Spinner size="sm" />
      ) : (
        <>
          {leftIcon && <span className="shrink-0 inline-flex items-center justify-center">{leftIcon}</span>}
          {children && (
            variant === 'none' ? (
              children
            ) : (
              <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0">
                {children}
              </span>
            )
          )}
          {rightIcon && <span className="shrink-0 inline-flex items-center justify-center">{rightIcon}</span>}
        </>
      )}
    </Comp>
  )
})
