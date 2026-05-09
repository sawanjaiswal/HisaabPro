/** ExpiryAlertCard — single expiry alert row for StockAlertsPage (BAT-05) */

import { AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

export interface ExpiryAlertCardData {
  id: string
  alertType: 'EXPIRY_NEAR' | 'EXPIRY_PASSED'
  status: 'ACTIVE' | 'RESOLVED'
  daysRemaining: number | null
  batch: {
    id: string
    batchNumber: string
    expiryDate: string
    currentStock: number
  }
  product: {
    id: string
    name: string
    sku: string | null
    unit: { symbol: string }
  }
  createdAt: string
}

interface ExpiryAlertCardProps {
  alert: ExpiryAlertCardData
}

function formatExpiryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function expiryLabel(daysRemaining: number | null, alertType: 'EXPIRY_NEAR' | 'EXPIRY_PASSED'): string {
  if (alertType === 'EXPIRY_PASSED') {
    if (daysRemaining == null) return 'Expired'
    const days = Math.abs(daysRemaining)
    return days === 0 ? 'Expired today' : `Expired ${days}d ago`
  }
  if (daysRemaining == null) return 'Expiring soon'
  return daysRemaining === 0 ? 'Expires today' : `${daysRemaining}d left`
}

export function ExpiryAlertCard({ alert }: ExpiryAlertCardProps) {
  const { t } = useLanguage()
  const isExpired = alert.alertType === 'EXPIRY_PASSED'
  const color = isExpired ? 'var(--color-error-500)' : 'var(--color-warning)'
  const surface = isExpired ? 'var(--color-danger-surface, #fff1f0)' : 'var(--color-warning-surface, #fffbeb)'

  return (
    <div
      role="listitem"
      className="card-primary"
      style={{ padding: 'var(--space-4)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
        <AlertTriangle size={16} aria-hidden="true" style={{ color, flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--fs-base)', color: 'var(--color-text-primary)' }}>
              {alert.product.name}
            </span>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color, background: surface, borderRadius: 'var(--radius-full)', padding: '2px 8px' }}>
              {isExpired ? t.expiryPassedAlert : t.expiryNearAlert}
            </span>
          </div>
          <div style={{ marginTop: 'var(--space-2)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)' }}>{t.expiryBatchLabel}</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{alert.batch.batchNumber}</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)' }}>{t.expiryDateLabel}</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color }}>{formatExpiryDate(alert.batch.expiryDate)}</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)' }}>{t.expiryStockLabel}</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{alert.batch.currentStock} {alert.product.unit.symbol}</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)' }}>Status</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color }}>{expiryLabel(alert.daysRemaining, alert.alertType)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
