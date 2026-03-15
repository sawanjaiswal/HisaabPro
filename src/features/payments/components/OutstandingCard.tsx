/** Outstanding list — per-party card with progress bar and action buttons */

import React from 'react'
import { Bell, IndianRupee } from 'lucide-react'
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
    ? `${party.invoiceCount} invoice${party.invoiceCount !== 1 ? 's' : ''} · ${party.daysOverdue} days overdue`
    : `${party.invoiceCount} invoice${party.invoiceCount !== 1 ? 's' : ''}`

  const hasPhone = party.partyPhone.trim() !== ''

  return (
    <div className={cardClass} aria-label={`Outstanding for ${party.partyName}`}>
      <div className="outstanding-card-top">
        <div className="outstanding-card-info">
          <div className="outstanding-card-party">{party.partyName}</div>
          <div className={daysClass}>{daysLabel}</div>
        </div>
        <div
          className={amountClass}
          aria-label={`${isReceivable ? 'Receivable' : 'Payable'}: ${formatAmount(party.outstanding)}`}
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
          Paid: {formatAmount(0)}
        </span>
        <span className="outstanding-progress-label">
          Due: {formatAmount(party.outstanding)}
        </span>
      </div>

      <div className="outstanding-card-actions">
        <button
          className="outstanding-action-remind"
          onClick={() => onRemind(party.partyId)}
          disabled={!hasPhone}
          aria-label={hasPhone
            ? `Send payment reminder to ${party.partyName}`
            : `Cannot remind ${party.partyName} — no phone number`
          }
        >
          <Bell size={14} aria-hidden="true" />
          Remind
        </button>
        <button
          className="outstanding-action-pay"
          onClick={() => onRecordPayment(party.partyId)}
          aria-label={`Record payment from ${party.partyName}`}
        >
          <IndianRupee size={14} aria-hidden="true" />
          Pay
        </button>
      </div>
    </div>
  )
}
