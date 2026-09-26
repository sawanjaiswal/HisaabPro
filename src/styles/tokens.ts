/**
 * SSOT Design System Tokens — Level 6 Axiomatic System
 * Immutable token definitions for Colors, Typography, Spacing, and Elevation.
 */

export const TYPOGRAPHY_VARIANTS = {
  'display-lg': 'text-[32px] leading-[40px] font-bold tracking-tight',
  'display-sm': 'text-[24px] leading-[32px] font-semibold tracking-tight',
  'heading-lg': 'text-[20px] leading-[28px] font-semibold tracking-tight',
  'heading-md': 'text-[18px] leading-[26px] font-semibold',
  'body-lg': 'text-[16px] leading-[24px]',
  'body-md': 'text-[14px] leading-[20px]',
  'body-sm': 'text-[12px] leading-[16px]',
  'caption': 'text-[11px] leading-[14px] font-medium tracking-wide uppercase',
} as const

export type TypographyVariant = keyof typeof TYPOGRAPHY_VARIANTS

export const TEXT_COLORS = {
  primary: 'text-[var(--text-primary)]',
  secondary: 'text-[var(--text-secondary)]',
  muted: 'text-[var(--text-muted)]',
  inverse: 'text-[var(--text-inverse)]',
  brand: 'text-[var(--color-primary-500)]',
  success: 'text-[var(--color-success-600)]',
  danger: 'text-[var(--color-error-600)]',
  warning: 'text-[var(--color-secondary-600)]',
} as const

export type TextColor = keyof typeof TEXT_COLORS

export const FONT_WEIGHTS = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
} as const

export type FontWeight = keyof typeof FONT_WEIGHTS

export const SURFACE_VARIANTS = {
  canvas: 'bg-[var(--surface-canvas)]',
  card: 'bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-xs rounded-xl',
  subtle: 'bg-[var(--surface-subtle)] border border-[var(--border-subtle)] rounded-lg',
  overlay: 'bg-[var(--surface-overlay)] border border-[var(--border-strong)] shadow-lg rounded-2xl',
  brand: 'bg-[var(--color-hero-surface)] text-white rounded-xl',
} as const

export type SurfaceVariant = keyof typeof SURFACE_VARIANTS

/**
 * Hook or utility to extract raw computed token colors for non-CSS contexts (Charts, Canvas, SVG).
 */
export function getChartThemeTokens(isDark = false) {
  return {
    brandPrimary: isDark ? '#068A48' : '#026F39',
    brandAccent: isDark ? '#E0EA49' : '#C8D232',
    success: isDark ? '#22C55E' : '#16A34A',
    danger: isDark ? '#EF4444' : '#DC2626',
    warning: isDark ? '#F59E0B' : '#D97706',
    gridBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
    textPrimary: isDark ? '#F9FAFB' : '#1F2937',
    textMuted: isDark ? '#9CA3AF' : '#6B7280',
    background: isDark ? '#0F172A' : '#FFFFFF',
  }
}
