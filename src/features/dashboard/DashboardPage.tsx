/** Dashboard — Home Page (lazy loaded)
 *
 * "Open app, see business" — instant value on first glance.
 * Layout: Header → Sales Hero → Outstanding Cards → Action Grid →
 * Upgrade Banner → Starred Contacts → Recent Transactions.
 * 4 UI states: loading, error, empty (first-time), success.
 */

import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useHomeDashboard } from './useDashboard'
import { buildTopPriorities } from './dashboard.utils'
import { QUICK_ACTIONS } from './dashboard.constants'
import { DashboardHeader } from './components/DashboardHeader'
import { DashboardSalesHero } from './components/DashboardSalesHero'
import { BusinessOverviewCarousel } from './components/BusinessOverviewCarousel'
import { DashboardQuickActions } from './components/DashboardQuickActions'
import { TopPrioritiesCard } from './components/TopPrioritiesCard'
import { TopDebtors } from './components/TopDebtors'
import { RecentActivityFeed } from './components/RecentActivityFeed'
import { DashboardSkeleton } from './components/DashboardSkeleton'
import { StaffDashboardSection } from './components/StaffDashboardSection'
import type { RecentActivityItem, PriorityItem } from './dashboard.types'
import './dashboard-page.css'
import './dashboard-hero.css'
import './dashboard-actions.css'
import './dashboard-stats-grid.css'
import './dashboard-priorities.css'
import './dashboard-starred.css'
import './dashboard-transactions.css'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { data, status, refresh } = useHomeDashboard()

  const handleQuickAction = (route: string) => navigate(route)

  const handleActivityClick = (item: RecentActivityItem) => {
    if (item.type === 'sale_invoice' || item.type === 'purchase_invoice') {
      navigate(ROUTES.INVOICE_DETAIL.replace(':id', item.id))
    } else {
      navigate(ROUTES.PAYMENT_DETAIL.replace(':id', item.id))
    }
  }

  const handleAddPayment = (item: RecentActivityItem) => {
    navigate(`${ROUTES.PAYMENT_NEW}?type=PAYMENT_IN&invoiceId=${item.id}&partyId=${item.partyId}`)
  }

  const handleViewAllActivity = () => navigate(ROUTES.REPORT_DAY_BOOK)

  const handleDebtorClick = (partyId: string) => {
    navigate(ROUTES.REPORT_PARTY_STATEMENT.replace(':partyId', partyId))
  }

  const handleViewAllOutstanding = () => navigate(ROUTES.OUTSTANDING)

  const handleViewAllPriorities = () => navigate(ROUTES.OUTSTANDING)
  const handlePriorityAction = (item: PriorityItem) => navigate(item.actionRoute)

  return (
    <AppShell>
      <DashboardHeader />

      <div className="dashboard-page stagger-enter">
        {/* Background pattern overlay */}
        <div className="dashboard-bg-pattern" aria-hidden="true" />

        {/* Loading */}
        {status === 'loading' && <DashboardSkeleton />}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title={t.dashboardErrorTitle}
            message={t.dashboardErrorMsg}
            onRetry={refresh}
          />
        )}

        {/* Success — Home 2 redesign (preview: mock-driven hero renders even
            before the business has data, so the layout is always visible). */}
        {status === 'success' && data && (
          <>
            {/* Dark hero area */}
            <div className="dashboard-top-section dashboard-top-section--dark py-0">
              <DashboardSalesHero />
            </div>

            {/* White drawer section */}
            <div className="dashboard-white-section py-0">
              <TopPrioritiesCard
                items={buildTopPriorities(data)}
                onViewAll={handleViewAllPriorities}
                onItemAction={handlePriorityAction}
              />

              <DashboardQuickActions actions={QUICK_ACTIONS} onAction={handleQuickAction} />

              <BusinessOverviewCarousel />

              <TopDebtors
                debtors={data.topDebtors}
                totalOutstanding={data.outstanding.receivable.total}
                onViewAll={handleViewAllOutstanding}
                onDebtorClick={handleDebtorClick}
              />

              <RecentActivityFeed
                items={data.recentActivity}
                onItemClick={handleActivityClick}
                onAddPayment={handleAddPayment}
                onViewAll={handleViewAllActivity}
              />

              <StaffDashboardSection />
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
