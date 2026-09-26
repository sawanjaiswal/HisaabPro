import React from 'react'
import {
  TYPOGRAPHY_VARIANTS,
  TypographyVariant,
  TEXT_COLORS,
  TextColor,
  FONT_WEIGHTS,
  FontWeight,
} from '../../styles/tokens'

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: TypographyVariant
  color?: TextColor
  weight?: FontWeight
  as?: 'p' | 'span' | 'div' | 'label' | 'strong' | 'em' | 'time'
  className?: string
  children?: React.ReactNode
}

export const Text: React.FC<TextProps> = ({
  variant = 'body-md',
  color = 'primary',
  weight,
  as: Component = 'p',
  className = '',
  children,
  ...props
}) => {
  const variantClass = TYPOGRAPHY_VARIANTS[variant] || TYPOGRAPHY_VARIANTS['body-md']
  const colorClass = TEXT_COLORS[color] || TEXT_COLORS.primary
  const weightClass = weight ? FONT_WEIGHTS[weight] : ''

  const combinedClasses = `${variantClass} ${colorClass} ${weightClass} ${className}`.trim()

  return (
    <Component className={combinedClasses} {...props}>
      {children}
    </Component>
  )
}
