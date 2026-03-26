/** InvoiceCard — single invoice row in the report list */

import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from '../report.constants'
import { formatAmount, formatReportDate } from '../report.utils'
import { ReportStatusBadge } from './ReportStatusBadge'
import type { InvoiceReportItem } from '../report.types'
import { useLanguage } from '@/hooks/useLanguage'

interface InvoiceCardProps {
  item: InvoiceReportItem
  onClick: (id: string) => void
}

export function InvoiceCard({item, onClick }: InvoiceCardProps) {
  const { t } = useLanguage()
    return (
    <div
      className="report-card"
      role="listitem"
      onClick={() => onClick(item.id)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick(item.id)
      }}
      aria-label={`Invoice ${item.number} — ${item.partyName}`}
    >
      <div className="report-card-header">
        <span className="report-card-number">{item.number}</span>
        <span className="report-card-date">{formatReportDate(item.date)}</span>
      </div>

      <div className="report-card-body">
        <span className="report-card-party">{item.partyName}</span>
        <span className="report-card-items">{item.itemCount} {t.items}</span>
      </div>

      <div className="report-card-footer">
        <div className="report-card-amounts">
          <span className="report-card-amount">{formatAmount(item.amount)}</span>
          {item.balance > 0 && (
            <span className="report-card-balance">{t.dueColon} {formatAmount(item.balance)}</span>
          )}
        </div>
        <ReportStatusBadge
          status={item.status}
          label={INVOICE_STATUS_LABELS[item.status]}
          color={INVOICE_STATUS_COLORS[item.status]}
        />
      </div>
      <div className="report-divider" aria-hidden="true" />
    </div>
  )
}
