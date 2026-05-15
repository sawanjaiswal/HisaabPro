/**
 * PageContainer — page-archetype wrapper.
 *
 * Variants map directly to the 4 layout archetypes used across HisaabPro:
 *   list      — grid of cards (1 col <sm, 2 col md, 3 col lg, 4 col xl)
 *   detail    — centered max-w-4xl on desktop, full-width on mobile
 *   form      — centered max-w-2xl on desktop (tighter), full-width on mobile
 *   dashboard — 1/2/3-col grid up to max-w-6xl
 *   split     — passthrough (consumer uses <ListDetailLayout> as child)
 *   full      — full-bleed, no max-width (POS, scanner, edge-to-edge pages)
 *
 * All variants apply `px-4` horizontal padding. Vertical padding stays with
 * the caller so feature pages keep control of section rhythm.
 */

import type { ReactNode } from 'react'

export type PageVariant =
  | 'list'
  | 'detail'
  | 'form'
  | 'dashboard'
  | 'split'
  | 'full'

interface PageContainerProps {
  children: ReactNode
  variant?: PageVariant
  className?: string
  /** Render-as a `<div>` instead of `<main>` (useful when nested inside an existing main). */
  asDiv?: boolean
}

const VARIANT_CLASS: Record<PageVariant, string> = {
  list: 'px-4 w-full mx-auto max-w-[var(--content-max-list)]',
  detail: 'px-4 w-full mx-auto max-w-[var(--content-max-detail)]',
  form: 'px-4 w-full mx-auto max-w-[var(--content-max-form)]',
  dashboard: 'px-4 w-full mx-auto max-w-[var(--content-max-dashboard)]',
  split: 'w-full',
  full: 'w-full',
}

export function PageContainer({
  children,
  variant = 'detail',
  className = '',
  asDiv = false,
}: PageContainerProps) {
  const cls = `page-container ${VARIANT_CLASS[variant]} ${className}`.trim()
  if (asDiv) return <div className={cls}>{children}</div>
  return <main className={cls}>{children}</main>
}

/**
 * Convenience class strings — when a feature page needs the grid inside the
 * container (e.g. a list page), it can apply this to its grid wrapper.
 */
export const RESPONSIVE_GRID = {
  /** 1 col mobile → 2 col md → 3 col lg → 4 col xl */
  list: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3',
  /** 1 col mobile → 2 col md → 3 col lg (dashboard hero cards) */
  dashboard: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
  /** 2 col mobile → 4 col md (compact stats) */
  stats: 'grid grid-cols-2 md:grid-cols-4 gap-3',
} as const
