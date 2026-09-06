import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ArrowDownLeft, ChevronRight, FileText } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { Button } from '@/components/ui/Button'
import type { RecentActivityItem } from '../../dashboard/dashboard.types'

interface PreviewActivityStreamProps {
  items: RecentActivityItem[]
}

function formatPaiseToRupees(paise: number): string {
  const rupees = Math.round(paise / 100)
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(rupees)
}

export function PreviewActivityStream({ items }: PreviewActivityStreamProps) {
  const navigate = useNavigate()

  const handleItemClick = (item: RecentActivityItem) => {
    if (item.type === 'sale_invoice' || item.type === 'purchase_invoice') {
      navigate(ROUTES.INVOICE_DETAIL.replace(':id', item.id))
    } else {
      navigate(ROUTES.PAYMENT_DETAIL.replace(':id', item.id))
    }
  }

  const isIncome = (type: string) => type === 'sale_invoice' || type === 'payment_in'

  return (
    <section className="activity-stream" aria-label="Recent transactions">
      <div className="activity-stream__header">
        <div className="activity-stream__title-box">
          <h3 className="activity-stream__title">Recent Stream</h3>
          <span className="activity-stream__count">{items.length} records</span>
        </div>
        <Button
          variant="none"
          className="activity-stream__all"
          onClick={() => navigate(ROUTES.REPORT_DAY_BOOK)}
        >
          <span>Day Book</span>
          <ChevronRight size={14} aria-hidden="true" />
        </Button>
      </div>

      <div className="activity-stream__list">
        {items.length === 0 ? (
          <div className="activity-stream__empty">
            <FileText size={28} aria-hidden="true" />
            <p>No transactions yet today</p>
          </div>
        ) : (
          items.slice(0, 5).map((item) => {
            const income = isIncome(item.type)
            return (
              <Button
                key={item.id}
                variant="none"
                className="activity-row"
                onClick={() => handleItemClick(item)}
              >
                <div className={`activity-row__icon${income ? ' activity-row__icon--income' : ' activity-row__icon--expense'}`}>
                  {income ? (
                    <ArrowDownLeft size={16} aria-hidden="true" />
                  ) : (
                    <ArrowUpRight size={16} aria-hidden="true" />
                  )}
                </div>

                <div className="activity-row__details">
                  <span className="activity-row__name">{item.partyName || 'Counter Sale'}</span>
                  <span className="activity-row__meta">
                    {item.reference || 'Sale Bill'} • {item.date ? new Date(item.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Today'}
                  </span>
                </div>

                <div className="activity-row__amount-col">
                  <span className={`activity-row__amount${income ? ' activity-row__amount--income' : ' activity-row__amount--expense'}`}>
                    {income ? '+' : '-'}₹{formatPaiseToRupees(item.amount)}
                  </span>
                  <span className="activity-row__badge">
                    {item.type.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </Button>
            )
          })
        )}
      </div>
    </section>
  )
}
