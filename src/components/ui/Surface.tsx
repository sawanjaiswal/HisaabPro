import React from 'react'
import { SURFACE_VARIANTS, SurfaceVariant } from '../../styles/tokens'

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant
  as?: 'div' | 'section' | 'article' | 'aside' | 'main'
  className?: string
  children?: React.ReactNode
}

export const Surface: React.FC<SurfaceProps> = ({
  variant = 'card',
  as: Component = 'div',
  className = '',
  children,
  ...props
}) => {
  const variantClass = SURFACE_VARIANTS[variant] || SURFACE_VARIANTS.card
  const combinedClasses = `${variantClass} ${className}`.trim()

  return (
    <Component className={combinedClasses} {...props}>
      {children}
    </Component>
  )
}
