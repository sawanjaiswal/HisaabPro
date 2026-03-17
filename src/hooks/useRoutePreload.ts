/** useRoutePreload — Preload lazy route chunks during idle time
 *
 * Fires once on mount. Uses requestIdleCallback to avoid blocking
 * the main thread. Preloads core nav routes so subsequent navigation
 * is instant (no spinner flash).
 */

import { useEffect } from 'react'
import { TIMINGS } from '@/config/timings'

const PRELOAD_ROUTES = [
  () => import('@/features/dashboard/DashboardPage'),
  () => import('@/features/parties/PartiesPage'),
  () => import('@/features/invoices/InvoicesPage'),
  () => import('@/features/products/ProductsPage'),
  () => import('@/features/payments/PaymentsPage'),
  () => import('@/features/reports/ReportsHubPage'),
  () => import('@/features/settings/SettingsPage'),
]

function preloadAll() {
  for (const load of PRELOAD_ROUTES) {
    load().catch(() => { /* silently ignore preload failures */ })
  }
}

export function useRoutePreload() {
  useEffect(() => {
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(preloadAll)
      return () => cancelIdleCallback(id)
    }

    const id = window.setTimeout(preloadAll, TIMINGS.preloadIdleTimeout)
    return () => window.clearTimeout(id)
  }, [])
}
