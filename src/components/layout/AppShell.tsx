import type { ReactNode } from 'react'
import { SuspendBanner } from '@/features/business/components/SuspendBanner'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <SuspendBanner />
      <div id="main-content" className="app-shell-content">{children}</div>
    </div>
  )
}
