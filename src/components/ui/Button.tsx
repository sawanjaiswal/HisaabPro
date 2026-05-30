import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { Spinner } from '@/components/feedback/Spinner'
import { cn } from '@/lib/utils'

// Variants map to the existing `btn-*` classes in components-ui.css — the visual
// identity is unchanged; cva only makes the variant/size contract type-safe and
// the single source of truth for the press/motion/haptic layer to build on.
export const buttonVariants = cva('btn', {
  variants: {
    variant: {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      accent: 'btn-accent',
      destructive: 'btn-destructive',
      ghost: 'btn-ghost',
      none: '',
    },
    size: {
      sm: 'btn-sm',
      md: 'btn-md',
      lg: 'btn-lg',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
})

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  // Render as the single child element (Radix Slot) — lets the motion layer wrap
  // a button as `<Press asChild><Button asChild><a/></Button></Press>` without
  // nesting interactive elements.
  asChild?: boolean
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant,
    size,
    loading = false,
    asChild = false,
    disabled,
    children,
    className,
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button'
  const classes = variant === 'none'
    ? className
    : cn(buttonVariants({ variant, size }), className)
  return (
    <Comp
      ref={ref}
      className={classes}
      disabled={asChild ? undefined : disabled || loading}
      aria-label={typeof children === 'string' ? children : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {!asChild && loading ? <Spinner size="sm" /> : children}
    </Comp>
  )
})
