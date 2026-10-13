/** Skeleton — Canonical shadcn Skeleton Primitive (SSOT)
 *
 * Pulsing surface placeholder for 0ms offline-first loading states.
 */

import React from 'react'
import { cn } from '@/lib/utils'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

export function Skeleton({
  className,
  rounded = 'md',
  ...props
}: SkeletonProps) {
  const radiusMap = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'motion-safe:animate-pulse bg-[var(--border-strong)]/60',
        radiusMap[rounded],
        className
      )}
      {...props}
    />
  )
}
