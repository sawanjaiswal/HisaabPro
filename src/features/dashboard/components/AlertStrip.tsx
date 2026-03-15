/** Dashboard — Alerts banner (Figma lime style)
 *
 * Shows as a lime-yellow banner when alerts exist.
 * Renders as transition element between top section and white card section.
 */

import React from 'react'
import { AlertTriangle, Clock, ChevronRight } from 'lucide-react'

interface AlertStripProps {
  lowStockCount: number
  overdueInvoiceCount: number
  onLowStockClick: () => void
  onOverdueClick: () => void
}

export const AlertStrip: React.FC<AlertStripProps> = ({
  lowStockCount,
  overdueInvoiceCount,
  onLowStockClick,
  onOverdueClick,
}) => {
  const hasAlerts = lowStockCount > 0 || overdueInvoiceCount > 0
  if (!hasAlerts) return null

  // Show the most important alert as the banner
  const isOverdue = overdueInvoiceCount > 0
  const alertTitle = isOverdue
    ? `${overdueInvoiceCount} ${overdueInvoiceCount === 1 ? 'invoice' : 'invoices'} overdue`
    : `${lowStockCount} ${lowStockCount === 1 ? 'item' : 'items'} low on stock`
  const alertSubtitle = isOverdue ? 'Tap to view overdue invoices' : 'Check stock levels'
  const handleClick = isOverdue ? onOverdueClick : onLowStockClick
  const AlertIcon = isOverdue ? Clock : AlertTriangle

  return (
    <div className="dashboard-alerts" role="alert" aria-label="Business alerts">
      <button
        className="dashboard-alert-banner"
        onClick={handleClick}
        aria-label={alertTitle}
      >
        <div className="dashboard-alert-icon">
          <AlertIcon size={20} aria-hidden="true" />
        </div>
        <div className="dashboard-alert-info">
          <div className="dashboard-alert-title">{alertTitle}</div>
          <div className="dashboard-alert-subtitle">{alertSubtitle}</div>
        </div>
        <div className="dashboard-alert-chevron">
          <ChevronRight size={20} aria-hidden="true" />
        </div>
      </button>

      {/* Second alert as small item if both exist */}
      {lowStockCount > 0 && overdueInvoiceCount > 0 && (
        <button
          className="dashboard-alert-item dashboard-alert-item--warning"
          onClick={onLowStockClick}
          aria-label={`${lowStockCount} items low on stock`}
          style={{ borderRadius: 0 }}
        >
          <AlertTriangle size={16} aria-hidden="true" />
          <span className="dashboard-alert-text">
            {lowStockCount} {lowStockCount === 1 ? 'item' : 'items'} low on stock
          </span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
