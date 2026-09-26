import React from 'react'
import {
  TYPOGRAPHY_VARIANTS,
  TypographyVariant,
  TEXT_COLORS,
  TextColor,
  FONT_WEIGHTS,
  FontWeight,
} from '../../styles/tokens'

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6
  variant?: TypographyVariant
  color?: TextColor
  weight?: FontWeight
  className?: string
  children?: React.ReactNode
}

export const Heading: React.FC<HeadingProps> = ({
  level = 2,
  variant,
  color = 'primary',
  weight,
  className = '',
  children,
  ...props
}) => {
  const Component = `h${level}` as React.ElementType

  const defaultVariant: TypographyVariant =
    variant ||
    (level === 1 ? 'display-lg' : level === 2 ? 'display-sm' : level === 3 ? 'heading-lg' : 'heading-md')

  const variantClass = TYPOGRAPHY_VARIANTS[defaultVariant]
  const colorClass = TEXT_COLORS[color] || TEXT_COLORS.primary
  const weightClass = weight ? FONT_WEIGHTS[weight] : ''

  const combinedClasses = `${variantClass} ${colorClass} ${weightClass} ${className}`.trim()

  return (
    <Component className={combinedClasses} {...props}>
      {children}
    </Component>
  )
}
