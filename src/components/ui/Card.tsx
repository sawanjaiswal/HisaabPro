import type { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'accent' | 'primary'
  elevated?: boolean
  compact?: boolean
  children: ReactNode
}

export function Card({
  variant = 'default',
  elevated = false,
  compact = false,
  children,
  className = '',
  ...props
}: CardProps) {
  if (process.env.NODE_ENV !== 'production' && variant !== 'default' && (elevated || compact)) {
    console.warn(`Card: "elevated" and "compact" props only apply to variant="default", got variant="${variant}"`)
  }

  const classes = [
    variant === 'default' ? 'card' : `card-${variant}`,
    variant === 'default' && elevated && 'card-elevated',
    variant === 'default' && compact && 'card-compact',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}
