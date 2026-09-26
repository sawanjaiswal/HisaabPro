/**
 * FormPageShell — Standard Level 6 Page Shell for Forms & Settings.
 *
 * Enforces:
 * 1. Global AppShell and Header with back navigation.
 * 2. Centered max-w-2xl responsive container with safe bottom scroll clearance.
 * 3. Guaranteed sticky BottomActionBar at the bottom of the viewport.
 * 4. Automatic form identifier wiring (`form="page-form"`).
 * 5. Built-in Loading Skeleton and Error states.
 */

import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { BottomActionBar } from '@/components/ui/BottomActionBar'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'

export interface FormPageShellProps {
  /** Title shown in the header */
  title: string
  /** Subtitle or helper description */
  subtitle?: string
  /** Path to navigate back or true for history.back() */
  backTo?: string | true
  /** Header action icons */
  actions?: ReactNode
  /** Form submission handler */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void
  /** Main form fields */
  children: ReactNode
  /** Buttons pinned to the sticky bottom action bar */
  footer: ReactNode
  /** Loading state */
  isLoading?: boolean
  /** Error message */
  error?: string | null
  /** Retry callback on error */
  onRetry?: () => void
  /** Custom CSS class on container */
  className?: string
}

export function FormPageShell({
  title,
  subtitle,
  backTo = true,
  actions,
  onSubmit,
  children,
  footer,
  isLoading = false,
  error = null,
  onRetry,
  className = '',
}: FormPageShellProps) {
  return (
    <AppShell>
      <Header title={title} subtitle={subtitle} backTo={backTo} actions={actions} />

      <PageContainer variant="form" className={`py-4 pb-32 ${className}`}>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton height="3rem" borderRadius="var(--radius-md)" />
            <Skeleton height="10rem" borderRadius="var(--radius-xl)" />
            <Skeleton height="3rem" borderRadius="var(--radius-md)" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : (
          <form id="page-form" onSubmit={onSubmit} className="space-y-6">
            {children}
          </form>
        )}
      </PageContainer>

      <BottomActionBar role="group" aria-label={`${title} actions`}>
        {footer}
      </BottomActionBar>
    </AppShell>
  )
}
