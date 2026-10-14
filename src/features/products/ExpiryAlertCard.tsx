import { AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

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

  return (
    <Card
      role="listitem"
      className="p-4"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={16}
          aria-hidden="true"
          className={cn('shrink-0 mt-0.5', isExpired ? 'text-[var(--color-error-500)]' : 'text-amber-500')}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">
              {alert.product.name}
            </span>
            <Badge variant={isExpired ? 'danger' : 'warning'}>
              {isExpired ? t.expiryPassedAlert : t.expiryNearAlert}
            </Badge>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-muted-foreground">{t.expiryBatchLabel}</div>
              <div className="text-sm font-medium">{alert.batch.batchNumber}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t.expiryDateLabel}</div>
              <div className={cn('text-sm font-medium', isExpired ? 'text-[var(--color-error-500)]' : 'text-amber-600')}>
                {formatExpiryDate(alert.batch.expiryDate)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t.expiryStockLabel}</div>
              <div className="text-sm font-medium">{alert.batch.currentStock} {alert.product.unit.symbol}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Status</div>
              <div className={cn('text-sm font-medium', isExpired ? 'text-[var(--color-error-500)]' : 'text-amber-600')}>
                {expiryLabel(alert.daysRemaining, alert.alertType)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
