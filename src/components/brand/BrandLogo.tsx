/**
 * BrandLogo — Central reusable logo component.
 *
 * Automatically renders the correct brand variant, handles sizes, theme
 * adaptations, responsiveness, and accessibility labels.
 */

import React from 'react'
import { BRAND, getBrandLogoPath, type BrandLogoVariant } from '@/config/brand.config'

export interface BrandLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Logo variant: 'horizontal' | 'horizontal-white' | 'icon' | 'icon-light' | 'icon-growth' | 'mark' | 'favicon' */
  variant?: BrandLogoVariant
  /** Preset size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  /** Whether explicitly in dark surface mode */
  isDark?: boolean
}

const SIZE_MAP = {
  xs: { height: 20 },
  sm: { height: 28 },
  md: { height: 36 },
  lg: { height: 48 },
  xl: { height: 64 },
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  isDark = false,
  className = '',
  style,
  alt = `${BRAND.name} - ${BRAND.tagline}`,
  ...rest
}) => {
  const src = getBrandLogoPath(variant, isDark)

  const sizeStyle: React.CSSProperties =
    typeof size === 'number'
      ? { height: size, width: 'auto' }
      : { height: SIZE_MAP[size].height, width: 'auto' }

  return (
    <img
      src={src}
      alt={alt}
      className={`brand-logo brand-logo--${variant} ${className}`.trim()}
      style={{
        display: 'inline-block',
        objectFit: 'contain',
        ...sizeStyle,
        ...style,
      }}
      loading="eager"
      {...rest}
    />
  )
}
