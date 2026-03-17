/** PageTransition — Smooth page enter animation on route change
 *
 * Wraps page content and re-keys on pathname so the CSS enter
 * animation replays on every navigation. CSS-only, no framer-motion.
 */

import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface PageTransitionProps {
  children: ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  const { pathname } = useLocation()

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  )
}
