import type { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean
  compact?: boolean
  children: ReactNode
}

export function Card({
  elevated = false,
  compact = false,
  children,
  className = '',
  ...props
}: CardProps) {
  const classes = [
    'card',
    elevated && 'card-elevated',
    compact && 'card-compact',
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
