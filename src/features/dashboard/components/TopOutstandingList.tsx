/** Dashboard — Top outstanding customers list
 *
 * Shows up to 5 customers with highest receivable outstanding.
 * Includes overdue badge, avatar initials, and "View All" footer.
 * All amounts in PAISE — formatted via formatCompactAmount.
 */

import React from 'react'
import { ChevronRight } from 'lucide-react'
import { formatCompactAmount, formatDate } from '../dashboard.utils'
import type { DashboardTopCustomer } from '../dashboard.types'

interface TopOutstandingListProps {
  customers: DashboardTopCustomer[]
  onViewAll: () => void
  onCustomerClick: (partyId: string) => void
}

/** Extract up to 2 initials from a name for the avatar */
function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

export const TopOutstandingList: React.FC<TopOutstandingListProps> = ({
  customers,
  onViewAll,
  onCustomerClick,
}) => {
  if (customers.length === 0) {
    return (
      <div className="dashboard-outstanding-card">
        <div className="dashboard-empty" aria-label="No outstanding receivables">
          <p className="dashboard-empty-title">No outstanding receivables</p>
          <p className="dashboard-empty-description">
            All your customers are up to date.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-outstanding-card" role="list" aria-label="Top outstanding customers">

      {customers.map((customer) => {
        const isSevere = customer.daysOverdue > 30
        const badgeClass = isSevere
          ? 'dashboard-overdue-badge dashboard-overdue-badge--severe'
          : 'dashboard-overdue-badge'

        return (
          <div
            key={customer.partyId}
            className="dashboard-outstanding-row"
            role="listitem button"
            tabIndex={0}
            aria-label={`${customer.name}, outstanding ${formatCompactAmount(customer.outstanding)}, ${customer.daysOverdue} days overdue`}
            onClick={() => onCustomerClick(customer.partyId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onCustomerClick(customer.partyId)
            }}
          >
            <div
              className="dashboard-outstanding-avatar"
              aria-hidden="true"
            >
              {getInitials(customer.name)}
            </div>

            <div className="dashboard-outstanding-info">
              <div className="dashboard-outstanding-name">{customer.name}</div>
              <div className="dashboard-outstanding-date">
                Due {formatDate(customer.oldestDueDate)}
              </div>
            </div>

            <div className="dashboard-outstanding-right">
              <span className="dashboard-outstanding-amount">
                {formatCompactAmount(customer.outstanding)}
              </span>
              {customer.daysOverdue > 0 && (
                <span className={badgeClass}>
                  {customer.daysOverdue}d overdue
                </span>
              )}
            </div>
          </div>
        )
      })}

      <div className="dashboard-outstanding-footer">
        <button
          className="dashboard-view-all-link"
          onClick={onViewAll}
          aria-label="View all outstanding receivables"
        >
          View All Outstanding
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>

    </div>
  )
}
