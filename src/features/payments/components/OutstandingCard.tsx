/** Receivables list row (mockup #17) — avatar, party, due status, amount.
 *
 * The old card carried a progress bar hardcoded to 0% and a "Paid: Rs 0.00"
 * label: OutstandingParty has no invoiced total, so both were decoration that
 * read as data. They are gone. Remind / Record-payment moved into the drawer
 * the row opens, which is where the party context already is.
 */

import React from 'react'
import { PartyAvatar } from '@/components/ui/PartyAvatar'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import type { OutstandingParty } from '../payment.types'

interface OutstandingCardProps {
  party: OutstandingParty
}

/** Whole days from today until `iso` — negative once the date has passed. */
function daysUntil(iso: string): number {
  const due = new Date(iso)
  if (Number.isNaN(due.getTime())) return 0
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((startOfDay(due) - startOfDay(new Date())) / 86_400_000)
}

export const OutstandingCard: React.FC<OutstandingCardProps> = ({ party }) => {
  const { t } = useLanguage()
  const isReceivable = party.type === 'RECEIVABLE'
  const isOverdue = party.daysOverdue > 0

  let status: string
  if (isOverdue) {
    status = `${t.overdueByLabel} ${party.daysOverdue} ${t.daysWord}`
  } else if (party.oldestDueDate) {
    const days = daysUntil(party.oldestDueDate)
    status = days <= 0 ? t.dueTodayLabel : `${t.dueInLabel} ${days} ${t.daysWord}`
  } else {
    const word = party.invoiceCount === 1 ? t.invoiceWord : t.invoicesWord
    status = `${party.invoiceCount} ${word}`
  }

  return (
    <div className="outstanding-row" aria-label={`${t.outstandingFor} ${party.partyName}`}>
      <PartyAvatar name={party.partyName} phone={party.partyPhone} size="md" />

      <div className="outstanding-row-main">
        <div className="outstanding-row-party">{party.partyName}</div>
        <div className={`outstanding-row-status${isOverdue ? ' outstanding-row-status--overdue' : ''}`}>
          {status}
        </div>
      </div>

      <span
        className={`outstanding-row-amount tabular-nums outstanding-row-amount--${isReceivable ? 'receivable' : 'payable'}`}
      >
        {formatPaise(Math.abs(party.outstanding))}
      </span>
    </div>
  )
}
