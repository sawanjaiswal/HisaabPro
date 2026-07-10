/** Sales Hub — top-tab page: Invoices | Estimates | Sale Orders | Challans.
 *
 * Replaces the Invoices BottomNav slot. Default tab = Invoices.
 * Each tab navigates to its child route; header/tabs are shared via this shell.
 * Top tab bar sticks below AppHeader per platform-shell C10.
 */

import { lazy, Suspense, useState, useEffect } from 'react'
import { useNavigate, useMatch } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { useLanguage } from '@/hooks/useLanguage'
import { DocumentListSkeleton } from './components/DocumentListSkeleton'
import { SALES_HUB_TABS, type SalesHubTab } from './sales.constants'
import './SalesHubPage.css'
import { Button } from '@/components/ui/Button'

const InvoicesContent  = lazy(() => import('../invoices/InvoicesPage'))
const EstimatesContent = lazy(() => import('./EstimatesPage'))
const SaleOrdersContent = lazy(() => import('./SaleOrdersPage'))
const ChallansContent  = lazy(() => import('./DeliveryChallansPage'))

function useActiveTab(): SalesHubTab {
  const onEstimates = useMatch('/sales/estimates/*')
  const onOrders    = useMatch('/sales/orders/*')
  const onChallans  = useMatch('/sales/challans/*')
  if (onEstimates) return 'estimates'
  if (onOrders)    return 'orders'
  if (onChallans)  return 'challans'
  return 'invoices'
}

export default function SalesHubPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const activeTab = useActiveTab()

  // Keep every tab a user has visited mounted (hidden via CSS) instead of
  // unmounting on switch — remounting reset scroll position, filters, and
  // re-fetched data, which read as a "flash" every time the user tabbed back.
  const [visitedTabs, setVisitedTabs] = useState<Set<SalesHubTab>>(() => new Set([activeTab]))
  useEffect(() => {
    setVisitedTabs((prev) => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)))
  }, [activeTab])

  const handleTabClick = (_tab: SalesHubTab, route: string) => {
    navigate(route, { replace: true })
  }

  return (
    <AppShell>
      <Header title={t.salesHub ?? 'Sales'} />

      <nav
        className="sales-hub-tabs"
        role="tablist"
        aria-label={t.salesHubTabs ?? 'Sales document types'}
        style={{ top: 'var(--header-height)' }}
      >
        {SALES_HUB_TABS.map((tab) => (
          <Button variant="none"
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`sales-hub-tab${activeTab === tab.id ? ' sales-hub-tab--active' : ''}`}
            onClick={() => handleTabClick(tab.id, tab.route)}
          >
            {tab.label}
          </Button>
        ))}
      </nav>

      <div className="sales-hub-content" role="tabpanel">
        <Suspense fallback={<DocumentListSkeleton />}>
          {visitedTabs.has('invoices') && (
            <div style={{ display: activeTab === 'invoices' ? 'block' : 'none' }}>
              <InvoicesContent embedded />
            </div>
          )}
          {visitedTabs.has('estimates') && (
            <div style={{ display: activeTab === 'estimates' ? 'block' : 'none' }}>
              <EstimatesContent embedded />
            </div>
          )}
          {visitedTabs.has('orders') && (
            <div style={{ display: activeTab === 'orders' ? 'block' : 'none' }}>
              <SaleOrdersContent embedded />
            </div>
          )}
          {visitedTabs.has('challans') && (
            <div style={{ display: activeTab === 'challans' ? 'block' : 'none' }}>
              <ChallansContent embedded />
            </div>
          )}
        </Suspense>
      </div>
    </AppShell>
  )
}
