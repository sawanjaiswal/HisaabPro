/** Stock Alerts — Page (lazy loaded)
 *
 * Lists open LOW_STOCK / OUT_OF_STOCK alerts for the active business.
 * 4 UI states: loading · error · empty · success.
 * 320px minimum, 375px primary.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Package } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { ROUTES } from '@/config/routes.config'
import { ExpiryAlertCard } from './ExpiryAlertCard'
import type { ExpiryAlertCardData } from './ExpiryAlertCard'

interface StockAlert {
  id: string
  type: 'LOW_STOCK' | 'OUT_OF_STOCK'
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
  product: {
    id: string
    name: string
    sku: string | null
    currentStock: number
    minStockLevel: number
    reorderQty: number | null
    unit: { symbol: string }
  }
  createdAt: string
}

interface AlertListResponse {
  alerts: StockAlert[]
  total: number
  pagination: { nextCursor: string | null }
}

interface ExpiryAlertListResponse {
  alerts: ExpiryAlertCardData[]
  total: number
  pagination: { nextCursor: string | null }
}

async function fetchAlerts(status?: string): Promise<AlertListResponse> {
  const qs = status ? `?status=${status}` : '?status=OPEN'
  return api<AlertListResponse>(`/stock-alerts${qs}`, { cacheReads: true })
}

async function fetchExpiryAlerts(): Promise<ExpiryAlertListResponse> {
  return api<ExpiryAlertListResponse>(`/inventory/expiry-alerts?status=ACTIVE`, { cacheReads: true })
}

async function dismissAlert(id: string): Promise<void> {
  return api<void>(`/stock-alerts/${id}/dismiss`, {
    method: 'POST',
    entityType: 'alert-dismiss',
    entityLabel: 'Alert dismiss',
  })
}

function shortfall(alert: StockAlert): number {
  return Math.max(0, alert.product.minStockLevel - alert.product.currentStock)
}

export default function StockAlertsPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dismissingId, setDismissingId] = useState<string | null>(null)

  const { data, status, refetch } = useQuery({
    queryKey: queryKeys.stockAlerts.list('OPEN'),
    queryFn: () => fetchAlerts('OPEN'),
  })

  const { data: expiryData, status: expiryStatus } = useQuery({
    queryKey: ['expiry-alerts', 'ACTIVE'],
    queryFn: () => fetchExpiryAlerts(),
  })

  const dismissMutation = useMutation({
    mutationFn: dismissAlert,
    onMutate: (id) => setDismissingId(id),
    onSuccess: () => {
      toast.success(t.alertDismissed)
      void queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all() })
    },
    onError: () => {
      toast.error(t.alertDismissFailed)
    },
    onSettled: () => setDismissingId(null),
  })

  const handleDismiss = (id: string) => {
    if (dismissingId) return
    dismissMutation.mutate(id)
  }

  const handleProductClick = (productId: string) => {
    navigate(ROUTES.PRODUCT_DETAIL.replace(':id', productId))
  }

  return (
    <AppShell>
      <Header title={t.stockAlertsTitle} backTo={ROUTES.PRODUCTS} />

      <PageContainer className="space-y-4">
        {status === 'pending' && (
          <div className="space-y-3" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-primary" style={{ padding: 'var(--space-4)' }}>
                <Skeleton height="1.25rem" width="55%" />
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <Skeleton height="1rem" width="75%" />
                </div>
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadAlerts}
            message={t.checkConnectionRetry}
            onRetry={() => void refetch()}
          />
        )}

        {status === 'success' && data && data.alerts.length === 0 && (
          <EmptyState
            icon={<Package size={40} aria-hidden="true" />}
            title={t.stockAlertsEmpty}
            description={t.stockAlertsEmptyDesc}
          />
        )}

        {/* BAT-05: Expiry alerts section */}
        {expiryStatus === 'success' && expiryData && expiryData.alerts.length > 0 && (
          <>
            <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-muted)', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {t.expiryAlertsTitle}
            </h2>
            <div role="list" className="space-y-3" aria-label={t.expiryAlertsTitle}>
              {expiryData.alerts.map((alert) => (
                <ExpiryAlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          </>
        )}

        {status === 'success' && data && data.alerts.length > 0 && (
          <>
            <div role="status" aria-live="polite" className="sr-only">
              {data.total} {t.stockAlertsHeading}
            </div>
            <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-muted)', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {t.stockAlertsHeading}
            </h2>
            <div role="list" className="space-y-3" aria-label={t.stockAlertsTitle}>
              {data.alerts.map((alert) => (
                <div
                  key={alert.id}
                  role="listitem"
                  className="card-primary"
                  style={{ padding: 'var(--space-4)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                    <button
                      className="btn-ghost"
                      style={{ flex: 1, textAlign: 'left', padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
                      onClick={() => handleProductClick(alert.product.id)}
                      aria-label={`${alert.product.name} — ${t.alertTypeLowStock}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <AlertTriangle
                          size={16}
                          aria-hidden="true"
                          style={{ color: alert.type === 'OUT_OF_STOCK' ? 'var(--color-danger)' : 'var(--color-warning)', flexShrink: 0 }}
                        />
                        <span style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
                          {alert.product.name}
                        </span>
                        <span
                          className={`badge ${alert.type === 'OUT_OF_STOCK' ? 'badge-danger' : 'badge-warning'}`}
                          style={{ fontSize: 'var(--text-xs)', padding: '2px 6px', borderRadius: 'var(--radius-full)' }}
                        >
                          {alert.type === 'OUT_OF_STOCK' ? t.outOfStockPill : t.lowStockPill}
                        </span>
                      </div>
                      <div style={{ marginTop: 'var(--space-2)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
                        <div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{t.alertCurrentStock}</div>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-danger)' }}>
                            {alert.product.currentStock} {alert.product.unit.symbol}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{t.alertMinLevel}</div>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                            {alert.product.minStockLevel} {alert.product.unit.symbol}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{t.alertShortfall}</div>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-warning)' }}>
                            {shortfall(alert)} {alert.product.unit.symbol}
                          </div>
                        </div>
                      </div>
                      {alert.product.reorderQty && alert.product.reorderQty > 0 && (
                        <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          {t.alertReorderQty}: {alert.product.reorderQty} {alert.product.unit.symbol}
                        </div>
                      )}
                    </button>

                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDismiss(alert.id)}
                      disabled={dismissingId === alert.id}
                      aria-label={`${t.dismissAlert} — ${alert.product.name}`}
                      style={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}
                    >
                      {dismissingId === alert.id ? t.dismissingAlert : t.dismissAlert}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
