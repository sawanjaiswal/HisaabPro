/** Dashboard — Recent transactions feed
 *
 * Figma: party initial avatar (colored circle), name, invoice ref + date,
 * amount, status text, "Add" payment pill for unpaid invoices.
 * All amounts in PAISE.
 */

import React from 'react'
import { ChevronRight, IndianRupee } from 'lucide-react'
import { formatCompactAmount } from '../dashboard.utils'
import type { RecentActivityItem } from '../dashboard.types'

interface RecentActivityFeedProps {
  items: RecentActivityItem[]
  onItemClick: (item: RecentActivityItem) => void
  onAddPayment: (item: RecentActivityItem) => void
  onViewAll: () => void
}

function getInitial(name: string): string {
  return (name.trim()[0] ?? '').toUpperCase()
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  items,
  onItemClick,
  onAddPayment,
  onViewAll,
}) => {
  if (items.length === 0) {
    return (
      <div className="dashboard-transactions">
        <div className="dashboard-section-header">
          <span className="dashboard-section-title">Recent Transactions</span>
        </div>
        <div className="dashboard-txn-empty">
          <p>No recent transactions yet.</p>
          <p>Create an invoice to get started.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-transactions">
      <div className="dashboard-section-header">
        <span className="dashboard-section-title">Recent Transactions</span>
        <button
          className="dashboard-section-link"
          onClick={onViewAll}
          aria-label="View all transactions in day book"
        >
          See All
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="dashboard-txn-list" role="list" aria-label="Recent transactions">
        {items.map((item) => {
          const isUnpaid = item.status === 'unpaid' || item.status === 'partial'
          const isInvoice = item.type === 'sale_invoice' || item.type === 'purchase_invoice'

          return (
            <div
              key={item.id}
              className="dashboard-txn-row"
              role="listitem"
              onClick={() => onItemClick(item)}
            >
              {/* Avatar */}
              <div className="dashboard-txn-avatar">
                <div className={`dashboard-txn-avatar-inner dashboard-txn-avatar-inner--${item.type}`}>
                  {getInitial(item.partyName)}
                </div>
              </div>

              {/* Info */}
              <div className="dashboard-txn-info">
                <span className="dashboard-txn-name">{item.partyName}</span>
                <div className="dashboard-txn-meta">
                  <span>{item.reference}</span>
                  <span className="dashboard-txn-meta-dot" aria-hidden="true" />
                  <span>{formatDate(item.date)}</span>
                </div>
              </div>

              {/* Amount + status */}
              <div className="dashboard-txn-right">
                <span className="dashboard-txn-amount">
                  - {formatCompactAmount(item.amount)}
                </span>
                {item.status && (
                  <span className={`dashboard-txn-status dashboard-txn-status--${item.status}`}>
                    {item.status === 'paid' ? 'PAID' : item.status === 'partial' ? 'PARTIAL' : 'UNPAID'}
                  </span>
                )}
                {item.mode && (
                  <span className="dashboard-txn-mode">{item.mode}</span>
                )}
              </div>

              {/* Add payment pill for unpaid invoices */}
              {isUnpaid && isInvoice && (
                <button
                  className="dashboard-txn-add-btn"
                  onClick={(e) => { e.stopPropagation(); onAddPayment(item) }}
                  aria-label={`Record payment for ${item.partyName}`}
                >
                  <IndianRupee size={16} aria-hidden="true" />
                  <span>Add</span>
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
