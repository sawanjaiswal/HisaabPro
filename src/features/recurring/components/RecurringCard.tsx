/** RecurringCard — Displays a single recurring invoice schedule
 *
 * Shows frequency, next run date, status badge, party name,
 * generated count, and inline pause/resume/delete actions.
 * All action callbacks are passed from the page — card is dumb.
 */

import React from 'react'
import { RefreshCw, Pause, Play, Trash2, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/format'
import {
  FREQUENCY_LABELS,
  STATUS_LABELS,
  STATUS_BADGE_VARIANTS,
} from '../recurring.constants'
import type { RecurringInvoice } from '../recurring.types'

interface RecurringCardProps {
  item: RecurringInvoice
  onPause: (id: string) => void
  onResume: (id: string) => void
  onDelete: (id: string) => void
}

export const RecurringCard: React.FC<RecurringCardProps> = ({
  item,
  onPause,
  onResume,
  onDelete,
}) => {
  const badgeVariant = STATUS_BADGE_VARIANTS[item.status]

  return (
    <div className="recurring-card">
      <div className="recurring-card__header">
        <div className="recurring-card__title-row">
          <span className="recurring-card__frequency">
            <RefreshCw size={14} aria-hidden="true" />
            {FREQUENCY_LABELS[item.frequency]}
          </span>
          <Badge variant={badgeVariant}>{STATUS_LABELS[item.status]}</Badge>
        </div>
        {item.partyName && (
          <p className="recurring-card__party">{item.partyName}</p>
        )}
      </div>

      <div className="recurring-card__meta">
        <span className="recurring-card__meta-item">
          <Calendar size={12} aria-hidden="true" />
          Next:{' '}
          {item.nextRunDate
            ? formatDate(item.nextRunDate)
            : '—'}
        </span>
        <span className="recurring-card__meta-item">
          {item.generatedCount}{' '}
          {item.generatedCount === 1 ? 'invoice' : 'invoices'} generated
        </span>
      </div>

      <div className="recurring-card__actions">
        {item.status === 'ACTIVE' && (
          <button
            type="button"
            className="recurring-card__action-btn recurring-card__action-btn--pause"
            onClick={() => onPause(item.id)}
            aria-label={`Pause recurring schedule for ${item.partyName ?? item.templateDocumentId}`}
          >
            <Pause size={14} aria-hidden="true" />
            Pause
          </button>
        )}
        {item.status === 'PAUSED' && (
          <button
            type="button"
            className="recurring-card__action-btn recurring-card__action-btn--resume"
            onClick={() => onResume(item.id)}
            aria-label={`Resume recurring schedule for ${item.partyName ?? item.templateDocumentId}`}
          >
            <Play size={14} aria-hidden="true" />
            Resume
          </button>
        )}
        <button
          type="button"
          className="recurring-card__action-btn recurring-card__action-btn--delete"
          onClick={() => onDelete(item.id)}
          aria-label={`Delete recurring schedule for ${item.partyName ?? item.templateDocumentId}`}
        >
          <Trash2 size={14} aria-hidden="true" />
          Delete
        </button>
      </div>
    </div>
  )
}
