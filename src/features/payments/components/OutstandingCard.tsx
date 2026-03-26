/** Outstanding list — per-party card with progress bar and action buttons */

import React from 'react'
import { Bell, IndianRupee } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { OutstandingParty } from '../payment.types'

interface OutstandingCardProps {
  party: OutstandingParty
  onRemind: (partyId: string) => void
  onRecordPayment: (partyId: string) => void
}

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function formatAmount(paise: number): string {
  return INR.format(Math.abs(paise) / 100)
}

export const OutstandingCard: React.FC<OutstandingCardProps> = ({
  party,
  onRemind,
  onRecordPayment,
}) => {
  const { t } = useLanguage()
  const isReceivable = party.type === 'RECEIVABLE'
  const isOverdue = party.daysOverdue > 0
  const cardClass = `outstanding-card${isOverdue ? ' outstanding-card--overdue' : ''}`
  const amountClass = isReceivable
    ? 'outstanding-card-amount outstanding-card-amount--receivable'
    : 'outstanding-card-amount outstanding-card-amount--payable'
  const daysClass = isOverdue
    ? 'outstanding-card-days outstanding-card-days--overdue'
    : 'outstanding-card-days'

  // Progress bar: paid portion out of total invoiced
  // We derive total from outstanding + estimated paid via invoiceCount heuristic.
  // Since we only have outstanding here, we show a fixed 0% fill when there's no
  // partial payment context — the bar still renders and conveys direction.
  const paidPct = 0 // OutstandingParty doesn't carry total invoiced; bar shows overdue state

  const daysLabel = isOverdue
    ? `${party.invoiceCount} ${party.invoiceCount !== 1 ? t.invoicesWord : t.invoiceWord} · ${party.daysOverdue} ${t.daysOverdue}`
    : `${party.invoiceCount} ${party.invoiceCount !== 1 ? t.invoicesWord : t.invoiceWord}`

  const hasPhone = party.partyPhone.trim() !== ''

  return (
    <div className={cardClass} aria-label={`${t.outstandingFor} ${party.partyName}`}>
      <div className="outstanding-card-top">
        <div className="outstanding-card-info">
          <div className="outstanding-card-party">{party.partyName}</div>
          <div className={daysClass}>{daysLabel}</div>
        </div>
        <div
          className={amountClass}
          aria-label={`${isReceivable ? t.receivable : t.payable}: ${formatAmount(party.outstanding)}`}
        >
          {formatAmount(party.outstanding)}
        </div>
      </div>

      <div className="outstanding-progress-bar" aria-hidden="true">
        <div
          className={`outstanding-progress-fill${isOverdue ? ' outstanding-progress-fill--overdue' : ''}`}
          style={{ width: `${paidPct}%` }}
        />
      </div>
      <div className="outstanding-progress-meta" aria-hidden="true">
        <span className="outstanding-progress-label outstanding-progress-label--paid">
          {t.paidColon} {formatAmount(0)}
        </span>
        <span className="outstanding-progress-label">
          {t.dueAmount} {formatAmount(party.outstanding)}
        </span>
      </div>

      <div className="outstanding-card-actions">
        <button
          className="outstanding-action-remind"
          onClick={() => onRemind(party.partyId)}
          disabled={!hasPhone}
          aria-label={hasPhone
            ? `${t.sendReminderTo} ${party.partyName}`
            : `${t.cannotRemindNoPhone} ${party.partyName}`
          }
        >
          <Bell size={14} aria-hidden="true" />
          {t.remindBtn}
        </button>
        <button
          className="outstanding-action-pay"
          onClick={() => onRecordPayment(party.partyId)}
          aria-label={`${t.recordPaymentFrom} ${party.partyName}`}
        >
          <IndianRupee size={14} aria-hidden="true" />
          {t.pay}
        </button>
      </div>
    </div>
  )
}
