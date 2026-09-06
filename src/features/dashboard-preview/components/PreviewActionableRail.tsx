import { useNavigate } from 'react-router-dom'
import { MessageSquare, AlertTriangle, ChevronRight } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { Button } from '@/components/ui/Button'
import type { HomeDashboardData } from '../../dashboard/dashboard.types'

interface PreviewActionableRailProps {
  data: HomeDashboardData
}

export function PreviewActionableRail({ data }: PreviewActionableRailProps) {
  const navigate = useNavigate()
  const topDebtor = data.topDebtors?.[0]
  const overdueCount = data.alerts.overdueInvoiceCount

  if (!topDebtor && overdueCount === 0) return null

  const handleWhatsAppReminder = () => {
    if (topDebtor) {
      const msg = encodeURIComponent(
        `Dear ${topDebtor.name}, gentle reminder regarding outstanding balance of ₹${Math.round(topDebtor.outstanding / 100)} with HisaabPro.`
      )
      window.open(`https://wa.me/?text=${msg}`, '_blank')
    } else {
      navigate(ROUTES.OUTSTANDING)
    }
  }

  return (
    <section className="action-rail" aria-label="Action required">
      <div className="action-rail__header">
        <h3 className="action-rail__title">Action Required</h3>
        <Button
          variant="none"
          className="action-rail__all"
          onClick={() => navigate(ROUTES.OUTSTANDING)}
        >
          <span>View All</span>
          <ChevronRight size={14} aria-hidden="true" />
        </Button>
      </div>

      <div className="action-rail__cards">
        {topDebtor && (
          <div className="action-card action-card--urgent">
            <div className="action-card__badge">
              <span className="action-card__badge-dot" />
              <span>Overdue ₹{Math.round(topDebtor.outstanding / 100)}</span>
            </div>
            <h4 className="action-card__party">{topDebtor.name}</h4>
            <p className="action-card__desc">Payment pending for {topDebtor.daysOverdue ?? 14} days</p>
            <Button
              variant="none"
              className="action-card__cta"
              onClick={handleWhatsAppReminder}
            >
              <MessageSquare size={14} aria-hidden="true" />
              <span>Send WhatsApp Reminder</span>
            </Button>
          </div>
        )}

        {data.alerts.lowStockCount > 0 && (
          <div className="action-card action-card--warning">
            <div className="action-card__badge action-card__badge--warn">
              <AlertTriangle size={12} aria-hidden="true" />
              <span>{data.alerts.lowStockCount} Items Low</span>
            </div>
            <h4 className="action-card__party">Inventory Alert</h4>
            <p className="action-card__desc">Reorder suggested to avoid stockout</p>
            <Button
              variant="none"
              className="action-card__cta action-card__cta--secondary"
              onClick={() => navigate(ROUTES.PRODUCTS)}
            >
              <span>Review Inventory</span>
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
