/** Route helpers — guards, shells, and persistent UI extracted from App.tsx. */

import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { Navigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@/config/routes.config'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { Spinner } from '@/components/feedback/Spinner'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNav } from '@/components/layout/BottomNav'
import { SideNavRail } from '@/components/layout/SideNavRail'
import { DashboardSkeleton } from '@/features/dashboard/components/DashboardSkeleton'
import { useAuth } from '@/context/AuthContext'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack'
import { CalculatorOverlay, FeedbackWidget, Login, Landing, AdminCoupons } from '@/app.routes'

export function PageRoute({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={fallback ?? <Spinner fullScreen />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}

export function DashboardFallback() {
  return (
    <AppShell>
      <DashboardSkeleton />
    </AppShell>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, businesses } = useAuth()
  const { pathname } = useLocation()
  if (isLoading) return <Spinner fullScreen />
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />
  // A freshly-registered user has no business yet — every business-scoped
  // route would 403 (NO_BUSINESS). Send them to onboarding to create their
  // first business. Exempt onboarding itself (redirect loop) and HOME, which
  // HomeGate routes on its own (incl. the separate admin-host surface).
  const exemptFromBusinessGate = pathname === ROUTES.ONBOARDING || pathname === ROUTES.HOME
  if (businesses.length === 0 && !exemptFromBusinessGate) {
    return <Navigate to={ROUTES.ONBOARDING} replace />
  }
  return <>{children}</>
}

export function GuestRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Spinner fullScreen />
  if (isAuthenticated) return <Navigate to={ROUTES.DASHBOARD} replace />
  return <>{children}</>
}

export function HomeGate() {
  const isNative = Capacitor.isNativePlatform()
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  if (isNative || host === 'app.hisaabpro.in') {
    return <GuestRoute><Login /></GuestRoute>
  }
  if (host === 'admin.hisaabpro.in') {
    return <ProtectedRoute><AdminCoupons /></ProtectedRoute>
  }
  return <GuestRoute><Landing /></GuestRoute>
}

const NAV_HIDDEN_PATTERNS = /\/(new|edit)(\/|$)|\/pos\b/

// Entity detail (leaf) pages are drilled into via the back-stack, not the tab
// bar — standard mobile apps hide the bottom nav there and let the page's own
// action footer own the bottom. Matches `/section/:id` only (list roots and
// `/section/:id/sub` keep the nav). Edit/new leaves are covered above.
const DETAIL_LEAF_PATTERN =
  /^\/(parties|products|invoices|payments|appointments|recurring|loans|godowns|jobs|batches|stock-verification)\/[^/]+$/

// Always-mounted (returns null) so the left-edge back-swipe listener is live on
// every authed screen without being tied to a route-conditional render.
export function EdgeSwipeBack() {
  useEdgeSwipeBack()
  return null
}

export function PersistentNav() {
  const { pathname } = useLocation()
  const { isAuthenticated } = useAuth()
  useKeyboardShortcuts(isAuthenticated)
  // Onboarding runs before the user has a business — Sales/Parties/etc. are
  // meaningless and the floating FAB visually overlaps the step's own CTA.
  if (
    !isAuthenticated ||
    pathname === ROUTES.ONBOARDING ||
    NAV_HIDDEN_PATTERNS.test(pathname) ||
    DETAIL_LEAF_PATTERN.test(pathname)
  )
    return null
  return (
    <>
      <SideNavRail />
      <BottomNav />
    </>
  )
}

export function FloatingWidgets() {
  const { pathname } = useLocation()
  if (pathname !== ROUTES.DASHBOARD) return null
  // Own error boundary, `null` fallback: these are optional decoration loaded
  // from separate chunks. Suspense covers a pending import but not a rejected
  // one, so without this a chunk that 404s (offline, or a stale tab after a
  // deploy) throws to the app-level boundary in App.tsx and replaces the entire
  // shell — nav included — with "Something went wrong". A calculator overlay
  // must not be able to take the navigation away mid-invoice.
  // See .claude/fix-trace-widget-chunk-blanks-app.md.
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}><CalculatorOverlay position="BOTTOM_LEFT" /></Suspense>
      <Suspense fallback={null}><FeedbackWidget /></Suspense>
    </ErrorBoundary>
  )
}
