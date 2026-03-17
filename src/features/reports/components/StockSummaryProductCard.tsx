/** StockSummaryProductCard — single product row in the stock summary list */

import { STOCK_STATUS_LABELS, STOCK_STATUS_COLORS } from '../report.constants'
import { formatAmount } from '../report.utils'
import { ReportStatusBadge } from './ReportStatusBadge'
import type { StockSummaryItem } from '../report.types'

interface StockSummaryProductCardProps {
  item: StockSummaryItem
}

export function StockSummaryProductCard({ item }: StockSummaryProductCardProps) {
  return (
    <div className="report-card" role="listitem">
      <div className="report-card-header">
        <span className="report-card-number">{item.name}</span>
        <ReportStatusBadge
          status={item.stockStatus}
          label={STOCK_STATUS_LABELS[item.stockStatus]}
          color={STOCK_STATUS_COLORS[item.stockStatus]}
        />
      </div>
      <div className="report-card-body">
        <span className="report-card-party">{item.category}</span>
        <span className="report-card-items">
          {item.currentStock} {item.unit}
        </span>
      </div>
      <div className="report-card-footer">
        <span className="report-card-balance">
          Purchase: {formatAmount(item.stockValueAtPurchase)}
        </span>
        <span className="report-card-amount">
          Sale: {formatAmount(item.stockValueAtSale)}
        </span>
      </div>
      <div className="report-divider" />
    </div>
  )
}
