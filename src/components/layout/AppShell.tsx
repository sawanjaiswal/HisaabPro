import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'

interface AppShellProps {
  children: ReactNode
  /** Force-hide the bottom nav (e.g. focused workflows like POS). Defaults to
   *  auto: hidden on /*\/new and /*\/edit so the form's sticky save bar owns
   *  the bottom safe-area without overlap. */
  hideNav?: boolean
}

function isFormRoute(pathname: string): boolean {
  return /\/(new|edit)(\/|$)/.test(pathname)
}

export function AppShell({ children, hideNav }: AppShellProps) {
  const { pathname } = useLocation()
  const showNav = hideNav === true ? false : !isFormRoute(pathname)

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div id="main-content" className="app-shell-content">{children}</div>
      {showNav && <BottomNav />}
    </div>
  )
}
