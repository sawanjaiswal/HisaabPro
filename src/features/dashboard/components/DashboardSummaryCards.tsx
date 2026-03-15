/** Dashboard — 2×2 stat card grid
 *
 * Renders Sales, Purchases, Receivable, Payable cards.
 * All amounts in PAISE — formatted via formatCompactAmount.
 */

import React from 'react'
import { TrendingUp, ShoppingCart, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { formatCompactAmount } from '../dashboard.utils'
import { DASHBOARD_CARD_LABELS, DASHBOARD_CARD_SUBLABELS } from '../dashboard.constants'
import type { DashboardStats } from '../dashboard.types'

interface DashboardSummaryCardsProps {
  stats: DashboardStats
  onCardClick: (type: string) => void
}

export const DashboardSummaryCards: React.FC<DashboardSummaryCardsProps> = ({
  stats,
  onCardClick,
}) => {
  return (
    <div className="dashboard-stats-grid" role="list" aria-label="Dashboard summary">

      {/* Sales */}
      <div
        className="dashboard-stat-card dashboard-stat-card--sales"
        role="listitem button"
        tabIndex={0}
        aria-label={`Sales: ${formatCompactAmount(stats.sales.amount)}, ${stats.sales.count} invoices`}
        onClick={() => onCardClick('sales')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onCardClick('sales')
        }}
      >
        <div className="dashboard-stat-header">
          <span className="dashboard-stat-label">{DASHBOARD_CARD_LABELS.sales}</span>
          <div className="dashboard-stat-icon" aria-hidden="true">
            <TrendingUp size={18} />
          </div>
        </div>
        <div className="dashboard-stat-amount">{formatCompactAmount(stats.sales.amount)}</div>
        <div className="dashboard-stat-sublabel">
          {stats.sales.count} {DASHBOARD_CARD_SUBLABELS.invoices}
        </div>
      </div>

      {/* Purchases */}
      <div
        className="dashboard-stat-card dashboard-stat-card--purchases"
        role="listitem button"
        tabIndex={0}
        aria-label={`Purchases: ${formatCompactAmount(stats.purchases.amount)}, ${stats.purchases.count} invoices`}
        onClick={() => onCardClick('purchases')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onCardClick('purchases')
        }}
      >
        <div className="dashboard-stat-header">
          <span className="dashboard-stat-label">{DASHBOARD_CARD_LABELS.purchases}</span>
          <div className="dashboard-stat-icon" aria-hidden="true">
            <ShoppingCart size={18} />
          </div>
        </div>
        <div className="dashboard-stat-amount">{formatCompactAmount(stats.purchases.amount)}</div>
        <div className="dashboard-stat-sublabel">
          {stats.purchases.count} {DASHBOARD_CARD_SUBLABELS.invoices}
        </div>
      </div>

      {/* Receivable */}
      <div
        className="dashboard-stat-card dashboard-stat-card--receivable"
        role="listitem button"
        tabIndex={0}
        aria-label={`Receivable: ${formatCompactAmount(stats.receivable.total)}, ${stats.receivable.partyCount} parties`}
        onClick={() => onCardClick('receivable')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onCardClick('receivable')
        }}
      >
        <div className="dashboard-stat-header">
          <span className="dashboard-stat-label">{DASHBOARD_CARD_LABELS.receivable}</span>
          <div className="dashboard-stat-icon" aria-hidden="true">
            <ArrowDownLeft size={18} />
          </div>
        </div>
        <div className="dashboard-stat-amount">{formatCompactAmount(stats.receivable.total)}</div>
        <div className="dashboard-stat-sublabel">
          {stats.receivable.partyCount} {DASHBOARD_CARD_SUBLABELS.parties}
        </div>
      </div>

      {/* Payable */}
      <div
        className="dashboard-stat-card dashboard-stat-card--payable"
        role="listitem button"
        tabIndex={0}
        aria-label={`Payable: ${formatCompactAmount(stats.payable.total)}, ${stats.payable.partyCount} parties`}
        onClick={() => onCardClick('payable')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onCardClick('payable')
        }}
      >
        <div className="dashboard-stat-header">
          <span className="dashboard-stat-label">{DASHBOARD_CARD_LABELS.payable}</span>
          <div className="dashboard-stat-icon" aria-hidden="true">
            <ArrowUpRight size={18} />
          </div>
        </div>
        <div className="dashboard-stat-amount">{formatCompactAmount(stats.payable.total)}</div>
        <div className="dashboard-stat-sublabel">
          {stats.payable.partyCount} {DASHBOARD_CARD_SUBLABELS.parties}
        </div>
      </div>

    </div>
  )
}
