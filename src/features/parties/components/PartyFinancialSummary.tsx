/** Party financial summary — Outstanding and the last payment as two calm
 *  divided tiles on one horizontal line above the detail tabs. Wording is
 *  direction-aware (a supplier reads "Total Payable"); amounts are paise and
 *  come from the server-derived payload.
 */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { SummaryTiles, type SummaryTileTone } from '@/components/ui/SummaryTiles'
import type { PartyDetail } from '../party.types'
import { formatAmount } from '../party.utils'

interface PartyFinancialSummaryProps {
  party: PartyDetail
}

export const PartyFinancialSummary: React.FC<PartyFinancialSummaryProps> = ({ party }) => {
  const { t } = useLanguage()
  const isSupplier = party.type === 'SUPPLIER'
  const due = Math.max(party.outstandingBalance, 0)
  const last = party.stats?.lastPayment ?? null

  const dueTone: SummaryTileTone = due > 0 ? 'due' : 'paid'
  const dueHint = due === 0 ? t.settled : (party.stats?.isOverdue && party.stats?.oldestDueDays ? `${party.stats.oldestDueDays}d ${t.overdue}` : undefined)

  return (
    <SummaryTiles
      variant="divided"
      aria-label={t.financialSummary}
      tiles={[
        {
          id: 'due',
          label: isSupplier ? t.totalPayable : t.outstanding,
          value: formatAmount(due),
          tone: dueTone,
          hint: dueHint,
          hintTone: due === 0 ? 'paid' : 'due',
        },
        {
          id: 'last-payment',
          label: t.lastPayment,
          value: last ? formatAmount(last.amount) : '—',
          tone: 'neutral',
          hint: last?.date ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(last.date)) : undefined,
        },
      ]}
    />
  )
}

