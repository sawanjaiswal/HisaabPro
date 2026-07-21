/**
 * BottomActionBar — the sticky bottom CTA every form page shares.
 *
 * Platform primitive: it owns `position: fixed; bottom: 0` and the safe-area
 * math so feature pages never touch either (PLATFORM_SHELL C6 / C9). Pass one
 * button for a full-width CTA, two for a split (Cancel / Save).
 */

import type { ReactNode } from 'react'
import './bottom-action-bar.css'

interface BottomActionBarProps {
  children: ReactNode
  /** Extra class for feature-specific tweaks — never for positioning. */
  className?: string
  /**
   * Names the bar for assistive tech. Only meaningful alongside a role that
   * accepts a name — pass `role="group"` (or similar) when the bar carries
   * more than a single button.
   */
  'aria-label'?: string
  role?: string
}

export function BottomActionBar({
  children,
  className,
  role,
  'aria-label': ariaLabel,
}: BottomActionBarProps) {
  return (
    <div
      className={className ? `bottom-action-bar ${className}` : 'bottom-action-bar'}
      role={role}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  )
}
