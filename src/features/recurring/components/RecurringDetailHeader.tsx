/** RecurringDetailHeader — name, party, status, next run, frequency stats */

import { Calendar, RefreshCw, FileText } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/format'
import { FREQUENCY_LABELS } from '../recurring.constants'
import { StatusPill } from './StatusPill'
import type { RecurringInvoice } from '../recurring.types'

interface RecurringDetailHeaderProps {
  schedule: RecurringInvoice
}

export function RecurringDetailHeader({ schedule }: RecurringDetailHeaderProps) {
  const { t } = useLanguage()

  const displayName = schedule.name ?? schedule.partyName ?? 'Recurring Schedule'

  return (
    <div className="recurring-detail-header">
      <div className="recurring-detail-header__top">
        <h1 className="recurring-detail-header__name">{displayName}</h1>
        <StatusPill status={schedule.status} />
      </div>

      {schedule.partyName && schedule.name && (
        <p className="recurring-detail-header__party">{schedule.partyName}</p>
      )}

      <div className="recurring-detail-header__meta">
        <div className="recurring-detail-header__meta-item">
          <RefreshCw size={14} aria-hidden="true" />
          <span>{FREQUENCY_LABELS[schedule.frequency]}</span>
        </div>

        {schedule.nextRunDate && (
          <div className="recurring-detail-header__meta-item">
            <Calendar size={14} aria-hidden="true" />
            <span>
              {t.recurringNextRun ?? 'Next run'}: {formatDate(schedule.nextRunDate)}
            </span>
          </div>
        )}

        <div className="recurring-detail-header__meta-item">
          <FileText size={14} aria-hidden="true" />
          <span>
            {schedule.generatedCount}{' '}
            {schedule.generatedCount === 1
              ? (t.invoiceGenerated ?? 'invoice generated')
              : (t.invoicesGenerated ?? 'invoices generated')}
          </span>
        </div>
      </div>

      {schedule.lastFailureReason && (
        <div className="recurring-detail-header__failure" role="alert">
          <span className="recurring-detail-header__failure-text">
            {schedule.lastFailureReason}
          </span>
        </div>
      )}
    </div>
  )
}
