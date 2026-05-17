/**
 * Commission #128 — Staff dashboard widget (MTD self-view).
 *
 * Mounted in DashboardPage. Resolves the active business from AuthContext
 * and gates rendering on the `commission.view` permission (owners pass
 * automatically because `permissions: []` + `isOwner: true`).
 *
 * If the user lacks `commission.view` → renders null (no widget). The
 * permission check mirrors server-side route gating so staff who can't
 * see their own ledger never see a widget that would 403.
 *
 * 4 UI states: loading skeleton · error · empty card (zero MTD) · success.
 * The error path stays silent (no toast) because the dashboard already
 * surfaces its own error state — a widget-level error is best logged.
 */

import { useNavigate } from 'react-router-dom'
import { Trophy, IndianRupee, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'
import { useAuth } from '@/context/AuthContext'
import { formatPaise } from '@/lib/format'
import { ROUTES } from '@/config/routes.config'
import { useCommissionLedger } from '../hooks/useCommissionLedger'
import {
  currentPeriodYearMonth,
  formatPeriodLabel,
  hasPermission,
} from '../commission.utils'
import '@/styles/components.commission.css'

interface CommissionWidgetProps {
  className?: string
}

export function CommissionWidget({ className }: CommissionWidgetProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { user, businesses } = useAuth()
  const activeBusiness =
    businesses.find((b) => b.id === user?.businessId) ?? businesses[0]

  const isOwner = (activeBusiness?.role ?? '').toUpperCase() === 'OWNER'
  const canView = hasPermission(activeBusiness?.permissions, 'commission.view', isOwner)

  const period = currentPeriodYearMonth()
  const enabled = !!user?.id && !!activeBusiness && canView

  const { summary, status, rows } = useCommissionLedger({
    periodYearMonth: period,
    // Omitted staffUserId → server treats as self-view.
    enabled,
  })

  // Permission gate — render nothing for staff without commission.view.
  if (!enabled) return null

  if (status === 'loading') {
    return (
      <Card className={`commission-widget ${className ?? ''}`.trim()}>
        <Skeleton height="20px" width="50%" />
        <Skeleton height="32px" width="60%" />
        <Skeleton height="16px" width="40%" />
      </Card>
    )
  }

  if (status === 'error') {
    // Dashboard already shows a global error — widget stays silent.
    return null
  }

  const totalPaise = summary?.totalCommissionPaise ?? 0
  const saleCount = summary?.rowCount ?? rows.length

  return (
    <Card
      className={`commission-widget ${className ?? ''}`.trim()}
      onClick={() => navigate(ROUTES.COMMISSION_LEDGER)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(ROUTES.COMMISSION_LEDGER)
        }
      }}
    >
      <div className="commission-widget__top">
        <span className="commission-widget__icon" aria-hidden="true">
          <Trophy size={18} />
        </span>
        <div className="commission-widget__title-block">
          <span className="commission-widget__title">
            {t.commissionWidgetTitle}
          </span>
          <span className="commission-widget__period">
            {formatPeriodLabel(period)}
          </span>
        </div>
        <ChevronRight
          size={18}
          aria-hidden="true"
          className="commission-widget__chevron"
        />
      </div>

      <div className="commission-widget__amount">
        <IndianRupee size={18} aria-hidden="true" />
        <span className="commission-widget__amount-value">
          {formatPaise(totalPaise)}
        </span>
      </div>

      <div className="commission-widget__meta">
        {totalPaise === 0
          ? t.commissionWidgetEmpty
          : t.commissionWidgetSaleCount.replace('{count}', String(saleCount))}
      </div>
    </Card>
  )
}
