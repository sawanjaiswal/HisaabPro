/** PageTransition — Smooth page enter animation + scroll-to-top on route change */

import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface PageTransitionProps {
  children: ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  )
}
