/**
 * Brand Configuration — Single Source of Truth (SSOT)
 * ----------------------------------------------------
 * All brand names, slogans, and logo asset paths across the web app and PWA.
 *
 * To change logos:
 * 1. Replace the file in `assets/branding/` and run `npm run brand:sync`
 * 2. Or update paths here if adding new variants.
 */

export const BRAND = {
  name: 'HisaabPro',
  mark: {
    base: 'Hisaab',
    accent: 'Pro',
  },
  tagline: 'Business Ka Hisaab, Ab Easy',
  subTagline: 'Simple • Trusted • Built for Indian Businesses',

  /** Official asset paths in /public */
  assets: {
    /** Primary horizontal logo with tagline (for light surfaces & cards) */
    logoHorizontal: '/logos/official/hisaabpro-logo-horizontal.png',
    /** White horizontal logo with tagline (for dark surfaces & emerald headers) */
    logoHorizontalWhite: '/logos/official/hisaabpro-logo-white.png',
    /** Square/Squircle Dark Emerald App Icon (512x512) */
    iconDark: '/logos/official/hisaabpro-icon-dark.png',
    /** Square/Squircle Light Cream App Icon (512x512) */
    iconLight: '/logos/official/hisaabpro-icon-light.png',
    /** Growth Chart Leaf Icon */
    iconGrowth: '/logos/official/hisaabpro-icon-growth.png',
    /** Isolated Leaf 'H' mark (transparent) */
    mark: '/logos/official/hisaabpro-h-mark.png',
    /** Vector SVG favicon */
    faviconSvg: '/favicon.svg',
    /** PNG Favicon (64x64) */
    faviconPng: '/favicon.png',
    /** PWA 192px icon */
    icon192: '/icon-192.png',
    /** PWA 512px icon */
    icon512: '/icon-512.png',
  },

  /** Color tokens for branding */
  colors: {
    primaryDark: '#073B2C',
    primary: '#026F39',
    leafGreen: '#22C55E',
    leafLight: '#4ADE80',
    creamBg: '#F8F7F4',
    goldAccent: '#C89B3C',
  },
} as const

export type BrandLogoVariant =
  | 'horizontal'
  | 'horizontal-white'
  | 'icon'
  | 'icon-light'
  | 'icon-growth'
  | 'mark'
  | 'favicon'

export function getBrandLogoPath(variant: BrandLogoVariant = 'horizontal', isDark = false): string {
  switch (variant) {
    case 'horizontal':
      return isDark ? BRAND.assets.logoHorizontalWhite : BRAND.assets.logoHorizontal
    case 'horizontal-white':
      return BRAND.assets.logoHorizontalWhite
    case 'icon':
      return isDark ? BRAND.assets.iconDark : BRAND.assets.iconDark
    case 'icon-light':
      return BRAND.assets.iconLight
    case 'icon-growth':
      return BRAND.assets.iconGrowth
    case 'mark':
      return BRAND.assets.mark
    case 'favicon':
      return BRAND.assets.faviconSvg
    default:
      return BRAND.assets.logoHorizontal
  }
}
