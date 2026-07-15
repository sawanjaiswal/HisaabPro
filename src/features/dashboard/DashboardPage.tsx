/** Dashboard — Home Page (lazy loaded)
 *
 * "Open app, see business" — instant value on first glance.
 * Layout: Header → Sales Hero → Outstanding Cards → Action Grid →
 * Upgrade Banner → Starred Contacts → Recent Transactions.
 * 4 UI states: loading, error, empty (first-time), success.
 */

import { useNavigate } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/config/routes.config'
import { useHomeDashboard } from './useDashboard'
import { isHomeDashboardEmpty, formatCompactAmount, getFirstName, buildTopPriorities } from './dashboard.utils'
import { QUICK_ACTIONS } from './dashboard.constants'
import { DashboardHeader } from './components/DashboardHeader'
import { DashboardStatsGrid } from './components/DashboardStatsGrid'
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

function getGreetingKey(): 'dashboardGreetingMorning' | 'dashboardGreetingAfternoon' | 'dashboardGreetingEvening' {
  const hour = new Date().getHours()
  if (hour < 12) return 'dashboardGreetingMorning'
  if (hour < 17) return 'dashboardGreetingAfternoon'
  return 'dashboardGreetingEvening'
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { user } = useAuth()
  const { data, status, refresh } = useHomeDashboard()
  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

  const handleQuickAction = (route: string) => navigate(route)
  const handleCollectClick = () => navigate(`${ROUTES.OUTSTANDING}?tab=receivable`)
  const handlePayClick = () => navigate(`${ROUTES.OUTSTANDING}?tab=payable`)

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

        {/* Empty — first-time user */}
        {status === 'success' && data && isHomeDashboardEmpty(data) && (
          <div className="dashboard-top-section py-0">
            <DashboardQuickActions actions={QUICK_ACTIONS} onAction={handleQuickAction} />
            <EmptyState
              icon={<BarChart3 size={48} aria-hidden="true" />}
              title={t.dashboardEmpty}
              description={t.dashboardEmptyDesc}
              action={
                <Button
                  variant="primary"
                  onClick={() => navigate(`${ROUTES.INVOICE_CREATE}?type=SALE`)}
                  aria-label={t.createInvoice}
                >
                  {t.createInvoice}
                </Button>
              }
            />
          </div>
        )}

        {/* Success — has data */}
        {status === 'success' && data && !isHomeDashboardEmpty(data) && (
          <>
            {/* Gradient area */}
            <div className="dashboard-top-section py-0">
              <div className="dashboard-greeting-row">
                <div>
                  <h1 className="dashboard-greeting-title">
                    {t[getGreetingKey()].replace('{name}', getFirstName(user?.name ?? ''))}
                  </h1>
                  <p className="dashboard-greeting-subtitle">{t.dashboardGreetingSubtitle}</p>
                </div>
                <span className="dashboard-greeting-date">{todayLabel}</span>
              </div>

              <div className={`dashboard-sales-hero ${data.today.salesAmount === 0 ? 'dashboard-sales-hero--zero' : ''}`}>
                <span className="dashboard-sales-label">{t.todaysSale}</span>
                {data.today.salesAmount > 0 ? (
                  <>
                    <span className="dashboard-sales-amount">
                      {formatCompactAmount(data.today.salesAmount)}
                    </span>
                    <span className="dashboard-sales-count">
                      {data.today.salesCount} {data.today.salesCount === 1 ? t.invoice : t.invoices}
                    </span>
                  </>
                ) : (
                  <Button variant="none"
                    className="dashboard-sales-cta"
                    onClick={() => navigate(`${ROUTES.INVOICE_CREATE}?type=SALE`)}
                    aria-label={t.createFirstInvoice}
                  >
                    {t.createFirstInvoice} &rarr;
                  </Button>
                )}
              </div>

              <DashboardStatsGrid
                receivableTotal={data.outstanding.receivable.total}
                payableTotal={data.outstanding.payable.total}
                paymentsReceivedAmount={data.today.paymentsReceivedAmount}
                paymentsMadeAmount={data.today.paymentsMadeAmount}
                onCollectClick={handleCollectClick}
                onPayClick={handlePayClick}
              />

              <TopPrioritiesCard
                items={buildTopPriorities(data)}
                onViewAll={handleViewAllPriorities}
                onItemAction={handlePriorityAction}
              />

              <DashboardQuickActions actions={QUICK_ACTIONS} onAction={handleQuickAction} />
            </div>

            {/* White drawer section */}
            <div className="dashboard-white-section py-0">
              <div className="dashboard-section-header">
                <h2 className="dashboard-section-title">{t.businessOverview}</h2>
              </div>

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
