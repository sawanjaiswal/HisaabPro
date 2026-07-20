/** Low Stock row (mockup #49) — product, stock vs reorder level, fill bar.
 *
 * The bar is stock ÷ minimum, so a nearly-empty product reads as empty at a
 * glance without having to compare two numbers.
 */

import React from 'react'
import { X, Package } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { severityOf, stockPercent } from '../stock-alerts.utils'
import type { StockAlert } from '../stock-alerts.types'

interface StockAlertRowProps {
  alert: StockAlert
  isDismissing: boolean
  onOpen: (productId: string) => void
  onDismiss: (alertId: string) => void
}

export const StockAlertRow: React.FC<StockAlertRowProps> = ({
  alert,
  isDismissing,
  onOpen,
  onDismiss,
}) => {
  const { t } = useLanguage()
  const { product } = alert
  const severity = severityOf(alert)
  const percent = stockPercent(alert)
  const tone = severity.toLowerCase()

  return (
    <div className="stock-alert-row" role="listitem">
      <Button
        type="button"
        variant="ghost"
        className="stock-alert-main"
        onClick={() => onOpen(product.id)}
        aria-label={`${product.name} — ${t.stockLabel} ${product.currentStock}`}
      >
        <span className="stock-alert-icon" aria-hidden="true">
          <Package size={20} />
        </span>

        <span className="stock-alert-text">
          <span className="stock-alert-name">{product.name}</span>
          <span className="stock-alert-unit">{product.unit.symbol}</span>
        </span>

        <span className="stock-alert-numbers">
          <span className={`stock-alert-stock stock-alert-stock--${tone} tabular-nums`}>
            {t.stockLabel}: {product.currentStock}
          </span>
          <span className="stock-alert-reorder tabular-nums">
            {t.reorderLabel}: {product.minStockLevel}
          </span>
        </span>
      </Button>

      <div className={`stock-alert-bar stock-alert-bar--${tone}`} aria-hidden="true">
        <div className="stock-alert-bar-fill" style={{ width: `${percent}%` }} />
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="stock-alert-dismiss"
        onClick={() => onDismiss(alert.id)}
        disabled={isDismissing}
        aria-label={`${t.dismissAlert} — ${product.name}`}
      >
        <X size={16} aria-hidden="true" />
      </Button>
    </div>
  )
}
