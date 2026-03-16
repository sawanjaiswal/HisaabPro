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
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useHomeDashboard } from './useDashboard'
import { isHomeDashboardEmpty, formatCompactAmount } from './dashboard.utils'
import { QUICK_ACTIONS } from './dashboard.constants'
import { DashboardHeader } from './components/DashboardHeader'
import { OutstandingHero } from './components/OutstandingHero'
import { DashboardQuickActions } from './components/DashboardQuickActions'
import { AlertStrip } from './components/AlertStrip'
import { TopDebtors } from './components/TopDebtors'
import { RecentActivityFeed } from './components/RecentActivityFeed'
import { DashboardSkeleton } from './components/DashboardSkeleton'
import type { RecentActivityItem, TopDebtor } from './dashboard.types'
import './dashboard.css'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data, status, refresh } = useHomeDashboard()

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

  const handleSendReminder = (debtor: TopDebtor) => {
    const message = `Hi ${debtor.name}, this is a reminder about your pending payment. Please settle at your earliest convenience.`
    const phone = debtor.phone.replace(/\D/g, '')
    const fullPhone = phone.length === 10 ? `91${phone}` : phone
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank')
  }

  const handleLowStockClick = () => navigate(ROUTES.REPORT_STOCK_SUMMARY)
  const handleOverdueClick = () => navigate(ROUTES.OUTSTANDING)

  return (
    <AppShell>
      <DashboardHeader profilePhoto="/assets/profile-placeholder.png" />

      <div className="dashboard-page">
        {/* Background pattern overlay */}
        <div className="dashboard-bg-pattern" aria-hidden="true" />

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

        {/* Empty — first-time user */}
        {status === 'success' && data && isHomeDashboardEmpty(data) && (
          <div className="dashboard-top-section">
            <DashboardQuickActions actions={QUICK_ACTIONS} onAction={handleQuickAction} />
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
          </div>
        )}

        {/* Success — has data */}
        {status === 'success' && data && !isHomeDashboardEmpty(data) && (
          <>
            {/* Gradient area */}
            <div className="dashboard-top-section">
              <div className="dashboard-sales-hero">
                <span className="dashboard-sales-label">Today&apos;s Sale</span>
                <span className="dashboard-sales-amount">
                  {formatCompactAmount(data.today.salesAmount)}
                </span>
              </div>

              <OutstandingHero
                receivableTotal={data.outstanding.receivable.total}
                receivablePartyCount={data.outstanding.receivable.partyCount}
                payableTotal={data.outstanding.payable.total}
                payablePartyCount={data.outstanding.payable.partyCount}
                onCollectClick={handleCollectClick}
                onPayClick={handlePayClick}
              />

              <DashboardQuickActions actions={QUICK_ACTIONS} onAction={handleQuickAction} />
            </div>

            {/* Upgrade banner + alerts → white section */}
            <AlertStrip
              lowStockCount={data.alerts.lowStockCount}
              overdueInvoiceCount={data.alerts.overdueInvoiceCount}
              onLowStockClick={handleLowStockClick}
              onOverdueClick={handleOverdueClick}
            />

            {/* White drawer section */}
            <div className="dashboard-white-section">
              <TopDebtors
                debtors={data.topDebtors}
                onViewAll={handleViewAllOutstanding}
                onDebtorClick={handleDebtorClick}
                onSendReminder={handleSendReminder}
              />

              <RecentActivityFeed
                items={data.recentActivity}
                onItemClick={handleActivityClick}
                onAddPayment={handleAddPayment}
                onViewAll={handleViewAllActivity}
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
