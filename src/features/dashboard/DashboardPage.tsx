/** Dashboard — Home Page (lazy loaded)
 *
 * Business summary: date range toggle, 2×2 stat grid, cash flow strip,
 * top outstanding list, quick actions. 4 UI states.
 */

import { useNavigate } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import { APP_NAME } from '@/config/app.config'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useDashboard } from './useDashboard'
import { isDashboardEmpty } from './dashboard.utils'
import { QUICK_ACTIONS } from './dashboard.constants'
import { DashboardDateRange } from './components/DashboardDateRange'
import { DashboardSummaryCards } from './components/DashboardSummaryCards'
import { DashboardCashFlow } from './components/DashboardCashFlow'
import { TopOutstandingList } from './components/TopOutstandingList'
import { DashboardQuickActions } from './components/DashboardQuickActions'
import { DashboardSkeleton } from './components/DashboardSkeleton'
import './dashboard.css'

const CARD_ROUTE_MAP: Record<string, string> = {
  sales: ROUTES.REPORT_SALES,
  purchases: ROUTES.REPORT_PURCHASES,
  receivable: ROUTES.OUTSTANDING,
  payable: ROUTES.OUTSTANDING,
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { stats, status, filters, setRange, refresh } = useDashboard()

  const handleCardClick = (type: string) => {
    const route = CARD_ROUTE_MAP[type]
    if (route) navigate(route)
  }

  const handleCustomerClick = (partyId: string) => {
    navigate(ROUTES.REPORT_PARTY_STATEMENT.replace(':partyId', partyId))
  }

  const handleViewAllOutstanding = () => {
    navigate(ROUTES.OUTSTANDING)
  }

  const handleQuickAction = (route: string) => {
    navigate(route)
  }

  return (
    <AppShell>
      <Header title={APP_NAME} />

      <PageContainer>
        {/* Date range pills — always visible */}
        <DashboardDateRange
          activeRange={filters.range}
          onRangeChange={setRange}
        />

        {/* Quick actions — always visible */}
        <DashboardQuickActions actions={QUICK_ACTIONS} onAction={handleQuickAction} />

        {/* Loading */}
        {status === 'loading' && <DashboardSkeleton />}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title="Couldn't load dashboard"
            message="Check your connection and pull to retry."
            onRetry={refresh}
          />
        )}

        {/* Empty — all zeros */}
        {status === 'success' && stats && isDashboardEmpty(stats) && (
          <EmptyState
            icon={<BarChart3 size={48} aria-hidden="true" />}
            title="Your dashboard is empty"
            description="Create your first invoice to see your business summary here."
            action={
              <button
                className="btn btn-primary btn-md"
                onClick={() => navigate(`${ROUTES.INVOICE_CREATE}?type=SALE`)}
                aria-label="Create first invoice"
              >
                Create Invoice
              </button>
            }
          />
        )}

        {/* Success — has data */}
        {status === 'success' && stats && !isDashboardEmpty(stats) && (
          <>
            <DashboardSummaryCards stats={stats} onCardClick={handleCardClick} />

            <DashboardCashFlow
              received={stats.paymentsReceived}
              paid={stats.paymentsMade}
              net={stats.netCashFlow}
            />

            {stats.topOutstandingCustomers.length > 0 && (
              <TopOutstandingList
                customers={stats.topOutstandingCustomers}
                onViewAll={handleViewAllOutstanding}
                onCustomerClick={handleCustomerClick}
              />
            )}
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
