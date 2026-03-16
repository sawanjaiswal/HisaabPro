/** Dashboard — Upgrade banner + alerts (Figma lime style)
 *
 * Always shows upgrade banner as lime strip.
 * Optionally shows alert items below for low stock / overdue.
 * Acts as the visual transition into the white drawer section.
 */

import React from 'react'
import { AlertTriangle, Clock, ChevronRight } from 'lucide-react'

interface AlertStripProps {
  lowStockCount: number
  overdueInvoiceCount: number
  onLowStockClick: () => void
  onOverdueClick: () => void
  onUpgradeClick?: () => void
}

export const AlertStrip: React.FC<AlertStripProps> = ({
  lowStockCount,
  overdueInvoiceCount,
  onLowStockClick,
  onOverdueClick,
  onUpgradeClick,
}) => {
  const hasAlerts = lowStockCount > 0 || overdueInvoiceCount > 0

  return (
    <div className="dashboard-alerts" role="complementary" aria-label="Promotions and alerts">
      {/* Upgrade banner — always visible */}
      <button
        className="dashboard-alert-banner"
        onClick={onUpgradeClick}
        aria-label="Upgrade to premium plan"
      >
        <div className="dashboard-alert-icon">
          <img src="/assets/icon-crown.svg" alt="" width={20} height={20} aria-hidden="true" />
        </div>
        <div className="dashboard-alert-info">
          <div className="dashboard-alert-title">Get the best of the app in &#8377;299 only</div>
          <div className="dashboard-alert-subtitle">Upgrade to unlock all features</div>
        </div>
        <div className="dashboard-alert-chevron">
          <ChevronRight size={20} aria-hidden="true" />
        </div>
      </button>

      {/* Alert items if any */}
      {hasAlerts && (
        <>
          {overdueInvoiceCount > 0 && (
            <button
              className="dashboard-alert-item dashboard-alert-item--danger"
              onClick={onOverdueClick}
              aria-label={`${overdueInvoiceCount} ${overdueInvoiceCount === 1 ? 'invoice' : 'invoices'} overdue`}
            >
              <Clock size={16} aria-hidden="true" />
              <span className="dashboard-alert-text">
                {overdueInvoiceCount} {overdueInvoiceCount === 1 ? 'invoice' : 'invoices'} overdue
              </span>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          )}
          {lowStockCount > 0 && (
            <button
              className="dashboard-alert-item dashboard-alert-item--warning"
              onClick={onLowStockClick}
              aria-label={`${lowStockCount} ${lowStockCount === 1 ? 'item' : 'items'} low on stock`}
            >
              <AlertTriangle size={16} aria-hidden="true" />
              <span className="dashboard-alert-text">
                {lowStockCount} {lowStockCount === 1 ? 'item' : 'items'} low on stock
              </span>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          )}
        </>
      )}
    </div>
  )
}
