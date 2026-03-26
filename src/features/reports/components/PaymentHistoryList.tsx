/** Payment History — Flat list rendering (groupBy === 'none') */

import { ReportCardList } from './ReportCardList'
import { formatAmount, formatReportDate } from '../report.utils'
import type { PaymentHistoryItem } from '../report.types'
import { useLanguage } from '@/hooks/useLanguage'

interface PaymentHistoryListProps {
  items: PaymentHistoryItem[]
}

export function PaymentHistoryList({items }: PaymentHistoryListProps) {
  const { t } = useLanguage()
    return (
    <ReportCardList ariaLabel={t.paymentHistory}>
      {items.map((item) => (
        <PaymentCard key={item.id} item={item} />
      ))}
    </ReportCardList>
  )
}

// ─── Shared card used by both flat and grouped views ─────────────────────────

interface PaymentCardProps {
  item: PaymentHistoryItem
}

export function PaymentCard({ item }: PaymentCardProps) {
  return (
    <div className="report-card" role="listitem">
      <div className="report-card-header">
        <span>{formatReportDate(item.date)}</span>
        <span>{item.partyName}</span>
      </div>
      <div className="report-card-body">
        <span className="report-card-mode">{item.mode}</span>
        {item.invoiceNumber !== null && (
          <span>&rarr; {item.invoiceNumber}</span>
        )}
        {item.reference !== '' && (
          <span className="report-card-ref">{item.reference}</span>
        )}
      </div>
      <div className="report-card-footer">
        <span
          style={{
            color:
              item.type === 'in'
                ? 'var(--color-success-600)'
                : 'var(--color-error-600)',
          }}
        >
          {item.type === 'in' ? '+' : '-'}
          {formatAmount(item.amount)}
        </span>
      </div>
      <div className="report-divider" />
    </div>
  )
}
