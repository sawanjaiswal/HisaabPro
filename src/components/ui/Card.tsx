import type { ReactNode, HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Variants map to the existing `card*` classes in components-ui.css — visual
// identity unchanged. `elevated`/`compact` only apply to variant="default"
// (accent/primary cards carry their own surface treatment).
export const cardVariants = cva('', {
  variants: {
    variant: { default: 'card', accent: 'card-accent', primary: 'card-primary' },
    elevated: { true: 'card-elevated', false: '' },
    compact: { true: 'card-compact', false: '' },
  },
  defaultVariants: { variant: 'default', elevated: false, compact: false },
})

interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  children: ReactNode
}

export function Card({
  variant = 'default',
  elevated = false,
  compact = false,
  children,
  className,
  ...props
}: CardProps) {
  if (
    process.env.NODE_ENV !== 'production' &&
    variant !== 'default' &&
    (elevated || compact)
  ) {
    console.warn(
      `Card: "elevated" and "compact" props only apply to variant="default", got variant="${variant}"`,
    )
  }

  // elevated/compact are no-ops for non-default variants.
  const e = variant === 'default' ? elevated : false
  const c = variant === 'default' ? compact : false

  return (
    <div className={cn(cardVariants({ variant, elevated: e, compact: c }), className)} {...props}>
      {children}
    </div>
  )
}
